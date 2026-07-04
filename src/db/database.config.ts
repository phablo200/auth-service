type DatabaseConfig = {
  connectionString: string;
};

function envValue(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

export function createDatabaseConfig(): DatabaseConfig {
  const connectionString =
    envValue("DATABASE_POOL_URL") || envValue("DATABASE_URL");

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set when DATABASE_POOL_URL is not set.");
  }

  return { connectionString };
}

export function createMaintenanceDatabaseConfig(): DatabaseConfig {
  const connectionString = envValue("DATABASE_URL");

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set for database maintenance commands.");
  }

  return { connectionString };
}
