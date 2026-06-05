import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/oauth-state.repository", () => ({
  default: {
    create: vi.fn(),
    findByHash: vi.fn(),
    markUsed: vi.fn(),
    consumeValid: vi.fn(),
    deleteExpired: vi.fn(),
  },
}));

vi.mock("../repositories/oauth-exchange.repository", () => ({
  default: {
    create: vi.fn(),
    findByHash: vi.fn(),
    markUsed: vi.fn(),
    consumeValid: vi.fn(),
    deleteExpired: vi.fn(),
  },
}));

vi.mock("../repositories/oauth-identity.repository", () => ({
  default: {
    findByProviderUser: vi.fn(),
    create: vi.fn(),
    updateEmail: vi.fn(),
  },
}));

vi.mock("../repositories/user.repository", () => ({
  default: {
    findById: vi.fn(),
    findByEmailRegistered: vi.fn(),
    undeleteById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../services/auth.service", () => ({
  default: {
    createAuthResponse: vi.fn(),
  },
}));

const provider = {
  slug: "google",
  buildAuthorizationUrl: vi.fn(),
  exchangeCode: vi.fn(),
  getProfile: vi.fn(),
};

vi.mock("../services/oauth/provider-registry", () => ({
  getOAuthProvider: vi.fn(() => provider),
  getEnabledOAuthProviders: vi.fn(() => [
    { provider: "google", enabled: true },
  ]),
}));

vi.mock("../services/oauth/oauth.config", () => ({
  getOAuthConfig: vi.fn(() => ({
    publicBaseUrl: "http://localhost:3001",
    stateTtlSeconds: 600,
    exchangeCodeTtlSeconds: 300,
    frontendRedirectAllowlist: ["http://localhost:5173/signin/callback"],
    enabledProviders: ["google"],
    defaultProfileId: "profile-oauth",
    providers: {
      google: {
        clientId: "client-id",
        clientSecret: "client-secret",
        callbackPath: "/api/auth/oauth/google/callback",
      },
    },
  })),
  buildProviderRedirectUri: vi.fn(() =>
    "http://localhost:3001/api/auth/oauth/google/callback"
  ),
}));

vi.mock("../services/oauth/oauth-state.service", () => ({
  createRandomToken: vi.fn(() => "random-token"),
  hashToken: vi.fn((token: string) => `hash-${token}`),
  createPkceChallenge: vi.fn(() => "challenge"),
  expiresFromNow: vi.fn(() => new Date("2026-06-04T12:00:00.000Z")),
}));

import oauthService from "../services/oauth/oauth.service";
import oauthStateRepository from "../repositories/oauth-state.repository";
import oauthExchangeRepository from "../repositories/oauth-exchange.repository";
import oauthIdentityRepository from "../repositories/oauth-identity.repository";
import userRepository from "../repositories/user.repository";
import authService from "../services/auth.service";
import {
  OAuthAccountConflictError,
  OAuthExchangeInvalidError,
} from "../errors/auth.error";

const applicationId = "00000000-0000-0000-0000-000000000002";
const user = {
  id: "user-id",
  application_id: applicationId,
  email: "test@email.com",
  name: "Test User",
  password: null,
  profile_id: "profile-oauth",
  deleted: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  provider.buildAuthorizationUrl.mockReturnValue("https://provider/auth");
  provider.exchangeCode.mockResolvedValue({ accessToken: "access-token" });
  provider.getProfile.mockResolvedValue({
    providerUserId: "provider-user-id",
    email: "test@email.com",
    emailVerified: true,
    displayName: "Test User",
  });
});

describe("OAuthService.authorize", () => {
  it("stores state and returns provider authorization URL", async () => {
    const result = await oauthService.authorize(
      applicationId,
      "google",
      "http://localhost:5173/signin/callback"
    );

    expect(oauthStateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stateHash: "hash-random-token",
        provider: "google",
        applicationId,
        redirectUri: "http://localhost:5173/signin/callback",
        codeVerifier: "random-token",
      })
    );
    expect(provider.buildAuthorizationUrl).toHaveBeenCalledWith({
      state: "random-token",
      codeChallenge: "challenge",
      redirectUri: "http://localhost:3001/api/auth/oauth/google/callback",
    });
    expect(result.authorization_url).toBe("https://provider/auth");
  });
});

describe("OAuthService.callback", () => {
  it("returns account conflict for same-email password users", async () => {
    vi.mocked(oauthStateRepository.consumeValid).mockResolvedValue({
      state_hash: "hash-state",
      provider: "google",
      application_id: applicationId,
      redirect_uri: "http://localhost:5173/signin/callback",
      code_verifier: "verifier",
      expires_at: new Date(Date.now() + 1000),
      used_at: null,
      created_at: new Date(),
    });
    vi.mocked(oauthIdentityRepository.findByProviderUser).mockResolvedValue(
      null
    );
    vi.mocked(userRepository.findByEmailRegistered).mockResolvedValue({
      ...user,
      password: "hashed-password",
    } as any);

    await expect(
      oauthService.callback("google", "provider-code", "state")
    ).rejects.toBeInstanceOf(OAuthAccountConflictError);
  });
});

describe("OAuthService.exchange", () => {
  it("returns the existing auth response for a valid exchange code", async () => {
    vi.mocked(oauthExchangeRepository.findByHash).mockResolvedValue({
      code_hash: "hash-code",
      application_id: applicationId,
      user_id: user.id,
      provider: "google",
      expires_at: new Date(Date.now() + 1000),
      used_at: null,
      created_at: new Date(),
    });
    vi.mocked(oauthExchangeRepository.consumeValid).mockResolvedValue({
      code_hash: "hash-code",
      application_id: applicationId,
      user_id: user.id,
      provider: "google",
      expires_at: new Date(Date.now() + 1000),
      used_at: new Date(),
      created_at: new Date(),
    });
    vi.mocked(userRepository.findById).mockResolvedValue(user as any);
    vi.mocked(authService.createAuthResponse).mockReturnValue({
      token: "jwt-token",
      user: user as any,
    });

    const result = await oauthService.exchange(applicationId, "code");

    expect(oauthExchangeRepository.consumeValid).toHaveBeenCalledWith(
      "hash-code"
    );
    expect(result.token).toBe("jwt-token");
  });

  it("rejects an exchange code from another application", async () => {
    vi.mocked(oauthExchangeRepository.consumeValid).mockResolvedValue({
      code_hash: "hash-code",
      application_id: "other-app",
      user_id: user.id,
      provider: "google",
      expires_at: new Date(Date.now() + 1000),
      used_at: null,
      created_at: new Date(),
    });

    await expect(
      oauthService.exchange(applicationId, "code")
    ).rejects.toBeInstanceOf(OAuthExchangeInvalidError);
  });
});
