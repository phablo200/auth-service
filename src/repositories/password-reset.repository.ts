import pool from "../db/pool";

class PasswordResetRepository {
  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    await pool.query(
      `
      INSERT INTO password_reset_tokens
        (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [userId, tokenHash, expiresAt]
    );
  }

  async findValidToken(tokenHash: string) {
    const result = await pool.query(
      `
      SELECT *
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND used = false
        AND expires_at > NOW()
      `,
      [tokenHash]
    );

    return result.rows[0] || null;
  }

  async markAsUsed(id: string): Promise<void> {
    await pool.query(
      `
      UPDATE password_reset_tokens
      SET used = true
      WHERE id = $1
      `,
      [id]
    );
  }
}

export default new PasswordResetRepository();
