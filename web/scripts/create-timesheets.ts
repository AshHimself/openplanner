import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = (
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  ""
).replace(/^﻿/, "").trim();

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log("Creating timesheet_entries table…");
  await sql`
    CREATE TABLE IF NOT EXISTS timesheet_entries (
      id          text PRIMARY KEY,
      project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      resource_id text REFERENCES resources(id) ON DELETE SET NULL,
      week_of     date NOT NULL,
      hours_logged numeric NOT NULL,
      notes       text,
      created_at  timestamp DEFAULT now() NOT NULL,
      updated_at  timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ts_project_week_idx
    ON timesheet_entries (project_id, week_of)
  `;
  console.log("Done.");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
