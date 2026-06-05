import { OAuthProviderClient } from "../../models/oauth.model";
import googleProvider from "../../providers/google/provider";
import githubProvider from "../../providers/github/provider";
import { ProviderNotSupportedError } from "../../errors/auth.error";
import { getOAuthConfig } from "./oauth.config";

const PROVIDER_SLUG_PATTERN = /^[a-z0-9-]+$/;

const registeredProviders: Record<string, OAuthProviderClient> = {
  [googleProvider.slug]: googleProvider,
  [githubProvider.slug]: githubProvider,
};

function isConfiguredProvider(provider: string): boolean {
  const config = getOAuthConfig();
  const providerConfig = config.providers[provider];

  return Boolean(
    providerConfig?.clientId &&
      providerConfig.clientSecret &&
      providerConfig.callbackPath
  );
}

export function validateProviderSlug(provider: string): void {
  if (!PROVIDER_SLUG_PATTERN.test(provider)) {
    throw new ProviderNotSupportedError();
  }
}

export function getOAuthProvider(provider: string): OAuthProviderClient {
  validateProviderSlug(provider);

  const config = getOAuthConfig();
  const client = registeredProviders[provider];
  const enabled = config.enabledProviders.includes(provider);

  if (!client || !enabled || !isConfiguredProvider(provider)) {
    throw new ProviderNotSupportedError();
  }

  return client;
}

export function getEnabledOAuthProviders(): { provider: string; enabled: boolean }[] {
  const config = getOAuthConfig();
  console.log({ config })
  return config.enabledProviders
    .filter((provider) => {
      console.log(provider);
      if (!PROVIDER_SLUG_PATTERN.test(provider)) {
        return false;
      }

      return Boolean(registeredProviders[provider] && isConfiguredProvider(provider));
    })
    .map((provider) => ({
      provider,
      enabled: true,
    }));
}
