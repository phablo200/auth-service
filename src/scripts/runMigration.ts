import dotenv from "dotenv";
import { runner } from "node-pg-migrate";
import {
  buildDatabaseConfig,
  parseMigrationDirection,
} from "./scriptUtils";

async function runMigrations() {
  dotenv.config();

  try {
    const direction = parseMigrationDirection(process.argv.slice(2));
    const migrations = await runner({
      databaseUrl: buildDatabaseConfig(process.env),
      dir: "src/db/migrations",
      migrationsTable: "pgmigrations",
      direction,
      singleTransaction: true,
      checkOrder: true,
      noLock: false,
    });

    if (migrations.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    for (const migration of migrations) {
      console.log(`Applied migration: ${migration.name}`);
    }

    console.log("Migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  }
}

runMigrations();
