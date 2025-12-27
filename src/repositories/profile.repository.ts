import pool from "../db/pool";
import { ProfileModel } from "../models/profile.model";

class ProfileRepository {
  async create(
    profile: Omit<ProfileModel, "id" |"deleted">
  ): Promise<ProfileModel> {
    const query = `
      INSERT INTO profiles (name, created_by, created_at, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      profile.name,
      profile.created_by || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findAll(): Promise<ProfileModel[]> {
    const query = `
      SELECT *
      FROM profiles
      WHERE deleted = false
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  async findById(id: string): Promise<ProfileModel | null> {
    const query = `
      SELECT *
      FROM profiles
      WHERE id = $1 AND deleted = false
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByName(name: string): Promise<ProfileModel | null> {
    const query = `
      SELECT *
      FROM profiles
      WHERE name = $1 AND deleted = false
    `;

    const result = await pool.query(query, [name]);
    return result.rows[0] || null;
  }

  async update(
    id: string,
    profile: Partial<Omit<ProfileModel, "id" | "created_at">>
  ): Promise<ProfileModel | null> {
    const query = `
      UPDATE profiles
      SET
        name = COALESCE($1, name),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = COALESCE($2, updated_by)
      WHERE id = $3 AND deleted = false
      RETURNING *
    `;

    const values = [
      profile.name || null,
      profile.updated_by || null,
      id,
    ];

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: string, deletedBy?: string): Promise<boolean> {
    const query = `
      UPDATE profiles
      SET deleted = true,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $2
      WHERE id = $1 AND deleted = false
    `;

    const result = await pool.query(query, [id, deletedBy || null]);
    return result.rowCount === 1;
  }

  async undeleteById(id: string): Promise<ProfileModel | null> {
    const query = `
      UPDATE profiles
      SET deleted = false,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async undeleteByName(name: string): Promise<ProfileModel | null> {
    const query = `
      UPDATE profiles
      SET deleted = false,
          updated_at = NOW()
      WHERE name = $1
      RETURNING *
    `;

    const result = await pool.query(query, [name]);
    return result.rows[0] || null;
  }
}

export default new ProfileRepository();
