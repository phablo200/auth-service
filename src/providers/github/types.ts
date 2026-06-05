export type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
};

export type GitHubUserResponse = {
  id?: number;
  login?: string;
  name?: string | null;
};

export type GitHubEmailResponse = {
  email: string;
  primary: boolean;
  verified: boolean;
};
