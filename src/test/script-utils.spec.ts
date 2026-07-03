import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  buildDatabaseConfig,
  listSqlFiles,
  parseMigrationDirection,
} from "../scripts/scriptUtils";

describe("parseMigrationDirection", () => {
  it("defaults to up", () => {
    expect(parseMigrationDirection([])).toBe("up");
  });

  it("accepts down", () => {
    expect(parseMigrationDirection(["down"])).toBe("down");
  });

  it("rejects unknown directions", () => {
    expect(() => parseMigrationDirection(["sideways"])).toThrow(
      "Invalid migration direction: sideways"
    );
  });
});

describe("buildDatabaseConfig", () => {
  it("uses DATABASE_URL when provided", () => {
    expect(buildDatabaseConfig({
      DATABASE_URL: "postgres://user:pass@localhost:5432/auth",
    })).toBe("postgres://user:pass@localhost:5432/auth");
  });

  it("builds config from DB_* values", () => {
    expect(buildDatabaseConfig({
      DB_USER: "user",
      DB_PASSWORD: "pass",
      DB_HOST: "localhost",
      DB_PORT: "5433",
      DB_NAME: "auth",
    })).toEqual({
      user: "user",
      password: "pass",
      host: "localhost",
      port: 5433,
      database: "auth",
    });
  });

  it("rejects incomplete DB_* config", () => {
    expect(() => buildDatabaseConfig({
      DB_USER: "user",
      DB_HOST: "localhost",
      DB_NAME: "auth",
    })).toThrow("Missing database env vars: DB_PASSWORD");
  });
});

describe("listSqlFiles", () => {
  it("returns only sql files sorted by filename", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "auth-seeds-"));

    fs.writeFileSync(path.join(directory, "002_second.sql"), "");
    fs.writeFileSync(path.join(directory, "001_first.sql"), "");
    fs.writeFileSync(path.join(directory, "notes.md"), "");

    expect(listSqlFiles(directory)).toEqual([
      "001_first.sql",
      "002_second.sql",
    ]);
  });
});
