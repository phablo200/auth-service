import fs from "fs";
import path from "path";

export type MigrationDirection = "up" | "down";

export type DatabaseConfig = string | {
  user: string | undefined;
  host: string | undefined;
  database: string | undefined;
  password: string | undefined;
  port: number;
};

export function parseMigrationDirection(args: string[]): MigrationDirection {
  const direction = args[0] ?? "up";

  if (direction !== "up" && direction !== "down") {
    throw new Error(`Invalid migration direction: ${direction}`);
  }

  return direction;
}

export function buildDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const requiredKeys = [
    "DB_USER",
    "DB_PASSWORD",
    "DB_HOST",
    "DB_NAME",
  ];
  const missingKeys = requiredKeys.filter((key) => !env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing database env vars: ${missingKeys.join(", ")}`);
  }

  return {
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT) || 5432,
  };
}

export function listSqlFiles(directory: string): string[] {
  return fs.readdirSync(directory)
    .filter((file) => path.extname(file) === ".sql")
    .sort();
}
