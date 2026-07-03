declare module "node-pg-migrate" {
  export type MigrationDirection = "up" | "down";

  export type ColumnDefinitions = Record<string, unknown>;

  export interface MigrationBuilder {
    sql(sql: string): void;
  }

  export interface RunMigration {
    name: string;
    path?: string;
    timestamp?: number;
  }

  export interface RunnerOption {
    databaseUrl: string | {
      user?: string;
      host?: string;
      database?: string;
      password?: string;
      port?: number;
    };
    dir: string | string[];
    migrationsTable: string;
    direction: MigrationDirection;
    singleTransaction?: boolean;
    checkOrder?: boolean;
    noLock?: boolean;
  }

  export function runner(options: RunnerOption): Promise<RunMigration[]>;
}
