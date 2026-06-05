export type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

export type GoogleTokenInfoResponse = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
};

export type GoogleUserInfoResponse = {
  name?: string;
};
