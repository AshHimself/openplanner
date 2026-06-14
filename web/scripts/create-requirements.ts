import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
const connectionString = (
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? ""
).replace(/^﻿/, "").trim();
const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log("Creating project_requirements table…");
  await sql`
    CREATE TABLE IF NOT EXISTS project_requirements (
      id          text PRIMARY KEY,
      project_id  text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role        text NOT NULL,
      fte         numeric NOT NULL,
      tags        text[] DEFAULT '{}'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS req_project_idx ON project_requirements (project_id)`;
  console.log("Done.");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
