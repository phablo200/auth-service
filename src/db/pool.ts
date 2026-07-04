import { Pool } from "pg";
import dotenv from "dotenv";
import { createDatabaseConfig } from "./database.config";

dotenv.config();

const pool = new Pool(createDatabaseConfig());

pool.on("connect", () => {
  console.log("✅ Connected to Postgres");
});

pool.on("error", (err: any) => {
  console.error("❌ Unexpected Postgres error", err);
  process.exit(-1);
});

export default pool;
