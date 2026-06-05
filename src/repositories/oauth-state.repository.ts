import pool from "../db/pool";
import { OAuthStateRecord } from "../models/oauth.model";

class OAuthStateRepository {
  async create(input: {
    stateHash: string;
    provider: string;
    applicationId: string;
    redirectUri: string;
    codeVerifier: string;
    expiresAt: Date;
  }): Promise<OAuthStateRecord> {
    const query = `
      INSERT INTO oauth_states (
        state_hash,
        provider,
        application_id,
        redirect_uri,
        code_verifier,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      input.stateHash,
      input.provider,
      input.applicationId,
      input.redirectUri,
      input.codeVerifier,
      input.expiresAt,
    ]);

    return result.rows[0];
  }

  async findByHash(stateHash: string): Promise<OAuthStateRecord | null> {
    const query = `
      SELECT *
      FROM oauth_states
      WHERE state_hash = $1
    `;

    const result = await pool.query(query, [stateHash]);
    return result.rows[0] || null;
  }

  async markUsed(stateHash: string): Promise<void> {
    const query = `
      UPDATE oauth_states
      SET used_at = NOW()
      WHERE state_hash = $1
    `;

    await pool.query(query, [stateHash]);
  }

  async consumeValid(stateHash: string): Promise<OAuthStateRecord | null> {
    const query = `
      UPDATE oauth_states
      SET used_at = NOW()
      WHERE state_hash = $1
        AND used_at IS NULL
        AND expires_at >= NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [stateHash]);
    return result.rows[0] || null;
  }

  async deleteExpired(): Promise<void> {
    await pool.query(`
      DELETE FROM oauth_states
      WHERE expires_at < NOW()
         OR used_at IS NOT NULL
    `);
  }
}

export default new OAuthStateRepository();
