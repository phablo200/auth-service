import pool from "../db/pool";
import { UserModel } from "../models/user.model";

class UserRepository {
  async create(
    user: Omit<UserModel, "id" | "created_at" | "updated_at" | "deleted">
  ): Promise<UserModel> {
    const query = `
      INSERT INTO users (
        application_id,
        name,
        email,
        password,
        profile_id,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      user.application_id,
      user.name,
      user.email,
      user.password,
      user.profile_id || null,
      user.created_by || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findAll(applicationId: string): Promise<UserModel[]> {
    const query = `
      SELECT *
      FROM users
      WHERE application_id = $1
        AND deleted = false
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [applicationId]);
    return result.rows;
  }

  async findById(
    applicationId: string,
    id: string
  ): Promise<UserModel | null> {
    const query = `
      SELECT *
      FROM users
      WHERE id = $1
        AND application_id = $2
        AND deleted = false
    `;

    const result = await pool.query(query, [id, applicationId]);
    return result.rows[0] || null;
  }

  async findByEmail(
    applicationId: string,
    email: string
  ): Promise<UserModel | null> {
    const query = `
      SELECT *
      FROM users
      WHERE email = $1
        AND application_id = $2
        AND deleted = false
    `;

    const result = await pool.query(query, [email, applicationId]);
    return result.rows[0] || null;
  }

  async findByEmailRegistered(
    applicationId: string,
    email: string
  ): Promise<UserModel | null> {
    const query = `
      SELECT *
      FROM users
      WHERE email = $1
        AND application_id = $2
    `;

    const result = await pool.query(query, [email, applicationId]);
    return result.rows[0] || null;
  }

  async update(
    applicationId: string,
    id: string,
    user: Partial<Omit<UserModel, "id" | "created_at" | "application_id">>
  ): Promise<UserModel | null> {
    const query = `
      UPDATE users
      SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        password = COALESCE($3, password),
        profile_id = COALESCE($4, profile_id),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = COALESCE($5, updated_by)
      WHERE id = $6
        AND application_id = $7
        AND deleted = false
      RETURNING *
    `;

    const values = [
      user.name || null,
      user.email || null,
      user.password || null,
      user.profile_id || null,
      user.updated_by || null,
      id,
      applicationId,
    ];

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(
    applicationId: string,
    id: string,
    deletedBy?: string
  ): Promise<boolean> {
    const query = `
      UPDATE users
      SET
        deleted = true,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $3
      WHERE id = $1
        AND application_id = $2
        AND deleted = false
    `;

    const result = await pool.query(query, [
      id,
      applicationId,
      deletedBy || null,
    ]);

    return result.rowCount === 1;
  }

  async undeleteById(
    applicationId: string,
    id: string
  ): Promise<UserModel | null> {
    const query = `
      UPDATE users
      SET
        deleted = false,
        updated_at = NOW()
      WHERE id = $1
        AND application_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [id, applicationId]);
    return result.rows[0] || null;
  }

  async undeleteByEmail(
    applicationId: string,
    email: string
  ): Promise<UserModel | null> {
    const query = `
      UPDATE users
      SET
        deleted = false,
        updated_at = NOW()
      WHERE email = $1
        AND application_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [email, applicationId]);
    return result.rows[0] || null;
  }

  async updatePassword(
    applicationId: string,
    id: string,
    password: string
  ): Promise<void> {
    const query = `
      UPDATE users
      SET
        password = $1,
        updated_at = NOW()
      WHERE id = $2
        AND application_id = $3
    `;

    await pool.query(query, [password, id, applicationId]);
  }
}

export default new UserRepository();
