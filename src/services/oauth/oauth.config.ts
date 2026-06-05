import dotenv from "dotenv";

dotenv.config();

const DEFAULT_STATE_TTL_SECONDS = 600;
const DEFAULT_EXCHANGE_CODE_TTL_SECONDS = 300;

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type OAuthProviderEnvironment = {
  clientId?: string;
  clientSecret?: string;
  callbackPath: string;
};

export type OAuthConfig = {
  publicBaseUrl: string;
  stateTtlSeconds: number;
  exchangeCodeTtlSeconds: number;
  frontendRedirectAllowlist: string[];
  enabledProviders: string[];
  defaultProfileId?: string;
  providers: Record<string, OAuthProviderEnvironment>;
};

export function getOAuthConfig(): OAuthConfig {
  return {
    publicBaseUrl:
      process.env.OAUTH_PUBLIC_BASE_URL || "http://localhost:3001",
    stateTtlSeconds: parsePositiveInteger(
      process.env.OAUTH_STATE_TTL_SECONDS,
      DEFAULT_STATE_TTL_SECONDS
    ),
    exchangeCodeTtlSeconds: parsePositiveInteger(
      process.env.OAUTH_EXCHANGE_CODE_TTL_SECONDS,
      DEFAULT_EXCHANGE_CODE_TTL_SECONDS
    ),
    frontendRedirectAllowlist: parseCsv(
      process.env.OAUTH_FRONTEND_REDIRECT_ALLOWLIST
    ),
    enabledProviders: parseCsv(process.env.OAUTH_ENABLED_PROVIDERS),
    defaultProfileId: process.env.OAUTH_DEFAULT_PROFILE_ID || undefined,
    providers: {
      google: {
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        callbackPath:
          process.env.GOOGLE_OAUTH_CALLBACK_PATH ||
          "/api/auth/oauth/google/callback",
      },
      github: {
        clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
        clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        callbackPath:
          process.env.GITHUB_OAUTH_CALLBACK_PATH ||
          "/api/auth/oauth/github/callback",
      },
    },
  };
}

export function buildProviderRedirectUri(provider: string): string {
  const config = getOAuthConfig();
  const providerConfig = config.providers[provider];

  if (!providerConfig) {
    return "";
  }

  return new URL(providerConfig.callbackPath, config.publicBaseUrl).toString();
}
