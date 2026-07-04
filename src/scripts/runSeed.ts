import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { createMaintenanceDatabaseConfig } from "../db/database.config";

function listSqlFiles(directory: string): string[] {
  return fs.readdirSync(directory)
    .filter((file) => path.extname(file) === ".sql")
    .sort();
}

async function runSeeds() {
  dotenv.config();
  const pool = new Pool(createMaintenanceDatabaseConfig());

  try {
    const seedsPath = path.join(__dirname, "../db/seeds");

    const files = listSqlFiles(seedsPath);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedsPath, file), "utf8");
      await pool.query(sql);
      console.log(`Applied seed: ${file}`);
    }

    console.log("All seeds completed successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runSeeds();
