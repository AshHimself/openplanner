import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Strip BOM that can appear when env vars are copy-pasted from Windows editors
const connectionString = (
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  ""
).replace(/^﻿/, "").trim();

const client = postgres(connectionString, { max: 1 });
export const db = drizzle(client, { schema });
