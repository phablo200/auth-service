import pool from "../db/pool";

export interface AuthOtp {
  id: string;
  application_id: string;
  user_id: string;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  used: boolean;
  created_at: Date;
}

class AuthOtpRepository {
  async create(
    applicationId: string,
    userId: string,
    codeHash: string,
    expiresAt: Date
  ): Promise<void> {
    const query = `
      INSERT INTO auth_otps (application_id, user_id, code_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `;

    await pool.query(query, [
      applicationId,
      userId,
      codeHash,
      expiresAt,
    ]);
  }

  async findLatestValid(
    applicationId: string,
    userId: string
  ): Promise<AuthOtp | null> {
    const query = `
      SELECT *
      FROM auth_otps
      WHERE application_id = $1
        AND user_id = $2
        AND used = false
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [
      applicationId,
      userId,
    ]);

    return result.rows[0] || null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await pool.query(
      `UPDATE auth_otps SET attempts = attempts + 1 WHERE id = $1`,
      [id]
    );
  }

  async markUsed(id: string): Promise<void> {
    await pool.query(
      `UPDATE auth_otps SET used = true WHERE id = $1`,
      [id]
    );
  }
}

export default new AuthOtpRepository();
