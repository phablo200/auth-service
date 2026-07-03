import fs from "fs";
import path from "path";
import pool from "../db/pool";
import { listSqlFiles } from "./scriptUtils";

async function runSeeds() {
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
