import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";

function listSqlFiles(directory: string): string[] {
  return fs.readdirSync(directory)
    .filter((file) => path.extname(file) === ".sql")
    .sort();
}

function createSeedPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });
}

async function runSeeds() {
  dotenv.config();
  const pool = createSeedPool();

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
