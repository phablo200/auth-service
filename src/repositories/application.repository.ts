import pool from "../db/pool";
import { ApplicationModel } from "../models/application.model";

class ApplicationRepository {
  async findById(id: string): Promise<ApplicationModel | null> {
    const query = `
      SELECT *
      FROM applications
      WHERE id = $1
        AND deleted = false
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }
}

export default new ApplicationRepository();
