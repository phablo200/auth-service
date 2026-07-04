import { Client } from "pg";
import dotenv from "dotenv";
import { createDatabaseConfig } from "./database.config";

dotenv.config();

const client = new Client(createDatabaseConfig());

export default client;
