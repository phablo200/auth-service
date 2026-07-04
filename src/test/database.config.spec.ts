import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseConfig,
  createMaintenanceDatabaseConfig,
} from "../db/database.config";

const DATABASE_ENV_KEYS = [
  "DATABASE_POOL_URL",
  "DATABASE_URL",
];

describe("createDatabaseConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };

    for (const key of DATABASE_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses DATABASE_POOL_URL before DATABASE_URL", () => {
    process.env.DATABASE_POOL_URL = "postgres://pooler.example/app";
    process.env.DATABASE_URL = "postgres://direct.example/app";

    expect(createDatabaseConfig()).toEqual({
      connectionString: "postgres://pooler.example/app",
    });
  });

  it("uses DATABASE_URL when DATABASE_POOL_URL is absent", () => {
    process.env.DATABASE_URL = "postgres://direct.example/app";

    expect(createDatabaseConfig()).toEqual({
      connectionString: "postgres://direct.example/app",
    });
  });

  it("throws when no runtime database URL is configured", () => {
    expect(() => createDatabaseConfig()).toThrow(
      "DATABASE_URL must be set when DATABASE_POOL_URL is not set.",
    );
  });

  it("uses DATABASE_URL for maintenance commands", () => {
    process.env.DATABASE_POOL_URL = "postgres://pooler.example/app";
    process.env.DATABASE_URL = "postgres://direct.example/app";

    expect(createMaintenanceDatabaseConfig()).toEqual({
      connectionString: "postgres://direct.example/app",
    });
  });

  it("throws when no maintenance database URL is configured", () => {
    expect(() => createMaintenanceDatabaseConfig()).toThrow(
      "DATABASE_URL must be set for database maintenance commands.",
    );
  });
});
