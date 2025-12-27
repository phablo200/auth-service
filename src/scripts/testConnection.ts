import fs from "fs";
import path from "path";
import client from "../db/client";

async function runMigrations() {
  try {
    await client.connect();
    const res = await client.query("SELECT NOW()");
    console.log("Database connected successfully at:", res.rows[0].now);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigrations();
