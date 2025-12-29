import fs from "fs";
import path from "path";
import pool from "../db/pool";

async function runMigrations() {
  try {
    const migrationsPath = path.join(__dirname, "../db/migrations");

    const files = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith(".sql"))
      .filter(file => file === "005_password_resets.sql")
      .sort(); // Ensures migrations run in order

    console.log('files', files);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsPath, file), "utf8");
      await pool.query(sql);
      console.log(`✅ Applied migration: ${file}`);
    }

    console.log("All migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

runMigrations();
