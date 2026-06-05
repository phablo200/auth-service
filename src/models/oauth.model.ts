import { UserModel } from "./user.model";

export type OAuthProviderSlug = string;

export type OAuthProviderProfile = {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
};

export type OAuthAuthorizationInput = {
  state: string;
  codeChallenge: string;
  redirectUri: string;
};

export type OAuthCodeExchangeInput = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

export type OAuthTokenResult = {
  accessToken?: string;
  idToken?: string;
};

export type OAuthProviderClient = {
  slug: OAuthProviderSlug;
  buildAuthorizationUrl(input: OAuthAuthorizationInput): string;
  exchangeCode(input: OAuthCodeExchangeInput): Promise<OAuthTokenResult>;
  getProfile(tokens: OAuthTokenResult): Promise<OAuthProviderProfile>;
};

export type OAuthStateRecord = {
  state_hash: string;
  provider: string;
  application_id: string;
  redirect_uri: string;
  code_verifier: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export type OAuthIdentityRecord = {
  id: string;
  application_id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  email: string;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
};

export type OAuthExchangeRecord = {
  code_hash: string;
  application_id: string;
  user_id: string;
  provider: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export type OAuthAuthResponse = {
  token: string;
  user: UserModel;
};
