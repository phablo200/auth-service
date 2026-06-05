import pool from "../db/pool";
import { OAuthExchangeRecord } from "../models/oauth.model";

class OAuthExchangeRepository {
  async create(input: {
    codeHash: string;
    applicationId: string;
    userId: string;
    provider: string;
    expiresAt: Date;
  }): Promise<OAuthExchangeRecord> {
    const query = `
      INSERT INTO oauth_login_exchanges (
        code_hash,
        application_id,
        user_id,
        provider,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      input.codeHash,
      input.applicationId,
      input.userId,
      input.provider,
      input.expiresAt,
    ]);

    return result.rows[0];
  }

  async findByHash(codeHash: string): Promise<OAuthExchangeRecord | null> {
    const query = `
      SELECT *
      FROM oauth_login_exchanges
      WHERE code_hash = $1
    `;

    const result = await pool.query(query, [codeHash]);
    return result.rows[0] || null;
  }

  async markUsed(codeHash: string): Promise<void> {
    const query = `
      UPDATE oauth_login_exchanges
      SET used_at = NOW()
      WHERE code_hash = $1
    `;

    await pool.query(query, [codeHash]);
  }

  async consumeValid(codeHash: string): Promise<OAuthExchangeRecord | null> {
    const query = `
      UPDATE oauth_login_exchanges
      SET used_at = NOW()
      WHERE code_hash = $1
        AND used_at IS NULL
        AND expires_at >= NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [codeHash]);
    return result.rows[0] || null;
  }

  async deleteExpired(): Promise<void> {
    await pool.query(`
      DELETE FROM oauth_login_exchanges
      WHERE expires_at < NOW()
         OR used_at IS NOT NULL
    `);
  }
}

export default new OAuthExchangeRepository();
