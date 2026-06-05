import pool from "../db/pool";
import { OAuthIdentityRecord } from "../models/oauth.model";

class OAuthIdentityRepository {
  async findByProviderUser(
    applicationId: string,
    provider: string,
    providerUserId: string
  ): Promise<OAuthIdentityRecord | null> {
    const query = `
      SELECT *
      FROM oauth_identities
      WHERE application_id = $1
        AND provider = $2
        AND provider_user_id = $3
    `;

    const result = await pool.query(query, [
      applicationId,
      provider,
      providerUserId,
    ]);

    return result.rows[0] || null;
  }

  async create(input: {
    applicationId: string;
    userId: string;
    provider: string;
    providerUserId: string;
    email: string;
    emailVerified: boolean;
  }): Promise<OAuthIdentityRecord> {
    const query = `
      INSERT INTO oauth_identities (
        application_id,
        user_id,
        provider,
        provider_user_id,
        email,
        email_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (application_id, provider, provider_user_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        email_verified = EXCLUDED.email_verified,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      input.applicationId,
      input.userId,
      input.provider,
      input.providerUserId,
      input.email,
      input.emailVerified,
    ]);

    return result.rows[0];
  }

  async updateEmail(
    id: string,
    email: string,
    emailVerified: boolean
  ): Promise<void> {
    const query = `
      UPDATE oauth_identities
      SET
        email = $2,
        email_verified = $3,
        updated_at = NOW()
      WHERE id = $1
    `;

    await pool.query(query, [id, email, emailVerified]);
  }
}

export default new OAuthIdentityRepository();
