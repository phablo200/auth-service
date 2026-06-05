import { URL } from "url";
import userRepository from "../../repositories/user.repository";
import oauthStateRepository from "../../repositories/oauth-state.repository";
import oauthIdentityRepository from "../../repositories/oauth-identity.repository";
import oauthExchangeRepository from "../../repositories/oauth-exchange.repository";
import authService from "../auth.service";
import { DEFAULT_PROFILE_ID } from "../../constants/profile.constants";
import { DEFAULT_USER_ID } from "../../constants/user.constants";
import { UserModel } from "../../models/user.model";
import { AppError } from "../../errors/app.error";
import {
  OAuthAccountConflictError,
  OAuthExchangeExpiredError,
  OAuthExchangeInvalidError,
  OAuthProviderError,
  OAuthStateExpiredError,
  OAuthStateInvalidError,
  ProviderEmailUnverifiedError,
} from "../../errors/auth.error";
import { getOAuthProvider, getEnabledOAuthProviders } from "./provider-registry";
import { buildProviderRedirectUri, getOAuthConfig } from "./oauth.config";
import {
  createPkceChallenge,
  createRandomToken,
  expiresFromNow,
  hashToken,
} from "./oauth-state.service";
import { OAuthProviderProfile } from "../../models/oauth.model";

type AuthorizeResult = {
  authorization_url: string;
  expires_at: string;
};

type ExchangeResult = {
  token: string;
  user: UserModel;
};

class OAuthService {
  getProviders() {
    return {
      providers: getEnabledOAuthProviders(),
    };
  }

  async authorize(
    applicationId: string,
    provider: string,
    redirectUri: string
  ): Promise<AuthorizeResult> {
    const client = getOAuthProvider(provider);
    this.assertAllowedRedirectUri(redirectUri);

    await oauthStateRepository.deleteExpired();

    const state = createRandomToken();
    const codeVerifier = createRandomToken();
    const codeChallenge = createPkceChallenge(codeVerifier);
    const config = getOAuthConfig();
    const providerRedirectUri = buildProviderRedirectUri(provider);
    const expiresAt = expiresFromNow(config.stateTtlSeconds);

    await oauthStateRepository.create({
      stateHash: hashToken(state),
      provider,
      applicationId,
      redirectUri,
      codeVerifier,
      expiresAt,
    });

    return {
      authorization_url: client.buildAuthorizationUrl({
        state,
        codeChallenge,
        redirectUri: providerRedirectUri,
      }),
      expires_at: expiresAt.toISOString(),
    };
  }

  async callback(
    provider: string,
    code: string,
    state: string
  ): Promise<string> {
    const client = getOAuthProvider(provider);
    const stateRecord = await this.consumeState(provider, state);
    const providerRedirectUri = buildProviderRedirectUri(provider);
    const tokens = await client.exchangeCode({
      code,
      codeVerifier: stateRecord.code_verifier,
      redirectUri: providerRedirectUri,
    });
    const profile = await client.getProfile(tokens);

    if (!profile.emailVerified) {
      throw new ProviderEmailUnverifiedError();
    }

    const user = await this.resolveUser(
      stateRecord.application_id,
      provider,
      profile
    );
    const exchangeCode = await this.createExchangeCode(
      stateRecord.application_id,
      user.id,
      provider
    );

    return this.buildFrontendRedirect(stateRecord.redirect_uri, {
      provider,
      status: "success",
      code: exchangeCode,
    });
  }

  async providerErrorCallback(
    provider: string,
    state: string,
    reason: string
  ): Promise<string> {
    const stateRecord = await this.consumeState(provider, state);

    return this.buildFrontendRedirect(stateRecord.redirect_uri, {
      provider,
      status: "error",
      reason: this.toSafeReason(reason),
    });
  }

  async exchange(
    applicationId: string,
    code: string
  ): Promise<ExchangeResult> {
    await oauthExchangeRepository.deleteExpired();

    const codeHash = hashToken(code);
    const exchangeRecord = await oauthExchangeRepository.consumeValid(codeHash);

    if (!exchangeRecord) {
      const existingRecord = await oauthExchangeRepository.findByHash(codeHash);

      if (
        existingRecord &&
        !existingRecord.used_at &&
        existingRecord.expires_at.getTime() < Date.now()
      ) {
        await oauthExchangeRepository.markUsed(codeHash);
        throw new OAuthExchangeExpiredError();
      }

      throw new OAuthExchangeInvalidError();
    }

    if (exchangeRecord.application_id !== applicationId) {
      throw new OAuthExchangeInvalidError();
    }

    const user = await userRepository.findById(
      applicationId,
      exchangeRecord.user_id
    );

    if (!user) {
      throw new OAuthExchangeInvalidError();
    }

    return authService.createAuthResponse(applicationId, user);
  }

  private async consumeState(provider: string, state: string) {
    await oauthStateRepository.deleteExpired();

    const stateHash = hashToken(state);
    const stateRecord = await oauthStateRepository.consumeValid(stateHash);

    if (!stateRecord) {
      const existingState = await oauthStateRepository.findByHash(stateHash);

      if (
        existingState &&
        !existingState.used_at &&
        existingState.expires_at.getTime() < Date.now()
      ) {
        await oauthStateRepository.markUsed(stateHash);
        throw new OAuthStateExpiredError();
      }

      throw new OAuthStateInvalidError();
    }

    if (stateRecord.provider !== provider) {
      throw new OAuthStateInvalidError();
    }

    return stateRecord;
  }

  private async resolveUser(
    applicationId: string,
    provider: string,
    profile: OAuthProviderProfile
  ): Promise<UserModel> {
    const identity = await oauthIdentityRepository.findByProviderUser(
      applicationId,
      provider,
      profile.providerUserId
    );

    if (identity) {
      await oauthIdentityRepository.updateEmail(
        identity.id,
        profile.email,
        profile.emailVerified
      );

      const linkedUser = await userRepository.findById(
        applicationId,
        identity.user_id
      );

      if (!linkedUser) {
        throw new OAuthProviderError();
      }

      return linkedUser;
    }

    const existingUser = await userRepository.findByEmailRegistered(
      applicationId,
      profile.email
    );

    if (existingUser && !existingUser.deleted && existingUser.password) {
      throw new OAuthAccountConflictError();
    }

    let user = existingUser;

    if (existingUser?.deleted) {
      user = await userRepository.undeleteById(applicationId, existingUser.id);
    }

    if (!user) {
      user = await userRepository.create({
        application_id: applicationId,
        name: profile.displayName,
        email: profile.email,
        password: null,
        profile_id: this.getDefaultProfileId(),
        created_by: DEFAULT_USER_ID,
        updated_by: DEFAULT_USER_ID,
      });
    }

    await oauthIdentityRepository.create({
      applicationId,
      userId: user.id,
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      emailVerified: profile.emailVerified,
    });

    return user;
  }

  private async createExchangeCode(
    applicationId: string,
    userId: string,
    provider: string
  ): Promise<string> {
    await oauthExchangeRepository.deleteExpired();

    const config = getOAuthConfig();
    const code = createRandomToken();

    await oauthExchangeRepository.create({
      codeHash: hashToken(code),
      applicationId,
      userId,
      provider,
      expiresAt: expiresFromNow(config.exchangeCodeTtlSeconds),
    });

    return code;
  }

  private assertAllowedRedirectUri(redirectUri: string): void {
    const config = getOAuthConfig();

    if (!config.frontendRedirectAllowlist.includes(redirectUri)) {
      throw new AppError("errors.oauthRedirectNotAllowed", 400);
    }
  }

  private getDefaultProfileId(): string {
    return getOAuthConfig().defaultProfileId || DEFAULT_PROFILE_ID;
  }

  private buildFrontendRedirect(
    redirectUri: string,
    params: Record<string, string>
  ): string {
    const url = new URL(redirectUri);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  private toSafeReason(reason: string): string {
    return /^[a-z0-9_-]+$/i.test(reason) ? reason : "oauth_provider_error";
  }
}

export default new OAuthService();
