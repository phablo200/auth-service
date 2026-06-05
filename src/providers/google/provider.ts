import {
  OAuthAuthorizationInput,
  OAuthCodeExchangeInput,
  OAuthProviderClient,
  OAuthProviderProfile,
  OAuthTokenResult,
} from "../oauth.provider";
import {
  OAuthCodeExchangeFailedError,
  OAuthProviderError,
} from "../../errors/auth.error";
import {
  buildProviderRedirectUri,
  getOAuthConfig,
} from "../../services/oauth/oauth.config";
import {
  GOOGLE_AUTHORIZATION_SCOPE,
  GOOGLE_AUTHORIZATION_URL,
  GOOGLE_CODE_CHALLENGE_METHOD,
  GOOGLE_GRANT_TYPE,
  GOOGLE_PROVIDER_SLUG,
  GOOGLE_RESPONSE_TYPE,
  GOOGLE_TOKEN_INFO_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USER_INFO_URL,
} from "./constants";
import {
  GoogleTokenInfoResponse,
  GoogleTokenResponse,
  GoogleUserInfoResponse,
} from "./types";

function getGoogleConfig() {
  const config = getOAuthConfig();
  const google = config.providers.google;

  if (!google?.clientId || !google.clientSecret) {
    throw new OAuthProviderError();
  }

  return {
    clientId: google.clientId,
    clientSecret: google.clientSecret,
    redirectUri: buildProviderRedirectUri(GOOGLE_PROVIDER_SLUG),
  };
}

class GoogleProvider implements OAuthProviderClient {
  slug = GOOGLE_PROVIDER_SLUG;

  buildAuthorizationUrl(input: OAuthAuthorizationInput): string {
    const config = getGoogleConfig();
    const url = new URL(GOOGLE_AUTHORIZATION_URL);

    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", GOOGLE_RESPONSE_TYPE);
    url.searchParams.set("scope", GOOGLE_AUTHORIZATION_SCOPE);
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", GOOGLE_CODE_CHALLENGE_METHOD);

    return url.toString();
  }

  async exchangeCode(
    input: OAuthCodeExchangeInput
  ): Promise<OAuthTokenResult> {
    const config = getGoogleConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.code,
        code_verifier: input.codeVerifier,
        grant_type: GOOGLE_GRANT_TYPE,
        redirect_uri: input.redirectUri,
      }),
    });

    const body = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || body.error || !body.id_token) {
      throw new OAuthCodeExchangeFailedError();
    }

    return {
      accessToken: body.access_token,
      idToken: body.id_token,
    };
  }

  async getProfile(tokens: OAuthTokenResult): Promise<OAuthProviderProfile> {
    const config = getGoogleConfig();

    if (!tokens.idToken) {
      throw new OAuthProviderError();
    }

    const tokenInfoResponse = await fetch(
      `${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(tokens.idToken)}`
    );
    const tokenInfo =
      (await tokenInfoResponse.json()) as GoogleTokenInfoResponse;

    if (
      !tokenInfoResponse.ok ||
      tokenInfo.aud !== config.clientId ||
      !tokenInfo.sub ||
      !tokenInfo.email
    ) {
      throw new OAuthProviderError();
    }

    let displayName = tokenInfo.name || tokenInfo.email.split("@")[0];

    if (tokens.accessToken) {
      const userInfoResponse = await fetch(GOOGLE_USER_INFO_URL, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (userInfoResponse.ok) {
        const userInfo =
          (await userInfoResponse.json()) as GoogleUserInfoResponse;
        displayName = userInfo.name || displayName;
      }
    }

    return {
      providerUserId: tokenInfo.sub,
      email: tokenInfo.email.toLowerCase(),
      emailVerified:
        tokenInfo.email_verified === true ||
        tokenInfo.email_verified === "true",
      displayName,
    };
  }
}

export default new GoogleProvider();
