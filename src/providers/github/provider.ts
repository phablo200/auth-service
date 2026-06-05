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
  GITHUB_API_VERSION,
  GITHUB_AUTHORIZATION_SCOPE,
  GITHUB_AUTHORIZATION_URL,
  GITHUB_CODE_CHALLENGE_METHOD,
  GITHUB_EMAILS_URL,
  GITHUB_PROVIDER_SLUG,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
} from "./constants";
import {
  GitHubEmailResponse,
  GitHubTokenResponse,
  GitHubUserResponse,
} from "./types";

function getGitHubConfig() {
  const config = getOAuthConfig();
  const github = config.providers.github;

  if (!github?.clientId || !github.clientSecret) {
    throw new OAuthProviderError();
  }

  return {
    clientId: github.clientId,
    clientSecret: github.clientSecret,
    redirectUri: buildProviderRedirectUri(GITHUB_PROVIDER_SLUG),
  };
}

class GitHubProvider implements OAuthProviderClient {
  slug = GITHUB_PROVIDER_SLUG;

  buildAuthorizationUrl(input: OAuthAuthorizationInput): string {
    const config = getGitHubConfig();
    const url = new URL(GITHUB_AUTHORIZATION_URL);

    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("scope", GITHUB_AUTHORIZATION_SCOPE);
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", GITHUB_CODE_CHALLENGE_METHOD);

    return url.toString();
  }

  async exchangeCode(
    input: OAuthCodeExchangeInput
  ): Promise<OAuthTokenResult> {
    const config = getGitHubConfig();
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.code,
        code_verifier: input.codeVerifier,
        redirect_uri: input.redirectUri,
      }),
    });

    const body = (await response.json()) as GitHubTokenResponse;

    if (!response.ok || body.error || !body.access_token) {
      throw new OAuthCodeExchangeFailedError();
    }

    return {
      accessToken: body.access_token,
    };
  }

  async getProfile(tokens: OAuthTokenResult): Promise<OAuthProviderProfile> {
    if (!tokens.accessToken) {
      throw new OAuthProviderError();
    }

    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    };

    const [userResponse, emailsResponse] = await Promise.all([
      fetch(GITHUB_USER_URL, { headers }),
      fetch(GITHUB_EMAILS_URL, { headers }),
    ]);

    if (!userResponse.ok || !emailsResponse.ok) {
      throw new OAuthProviderError();
    }

    const user = (await userResponse.json()) as GitHubUserResponse;
    const emails = (await emailsResponse.json()) as GitHubEmailResponse[];
    const primaryEmail = emails.find(
      (email) => email.primary && email.verified
    );

    if (!user.id || !primaryEmail) {
      throw new OAuthProviderError();
    }

    return {
      providerUserId: String(user.id),
      email: primaryEmail.email.toLowerCase(),
      emailVerified: primaryEmail.verified,
      displayName: user.name || user.login || primaryEmail.email.split("@")[0],
    };
  }
}

export default new GitHubProvider();
