import fs from "fs";
import path from "path";
import pool from "../db/pool";

async function runSeeds() {
  try {
    const seedsPath = path.join(__dirname, "../db/seeds");

    const files = fs.readdirSync(seedsPath)
      .filter(file => file.endsWith(".sql"))
      .filter(file => file === "002_seed_initial_application.sql")
      .sort(); // Ensures seeds run in order

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedsPath, file), "utf8");
      await pool.query(sql);
      console.log(`✅ Applied seed: ${file}`);
    }

    console.log("All seeds completed successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}

runSeeds();
