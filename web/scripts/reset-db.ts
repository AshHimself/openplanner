import "dotenv/config";
import { sql } from "@vercel/postgres";

async function main() {
  // Drop tables in dependency order
  await sql`DROP TABLE IF EXISTS allocations CASCADE`;
  await sql`DROP TABLE IF EXISTS projects CASCADE`;
  await sql`DROP TABLE IF EXISTS resources CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  await sql`DROP TYPE IF EXISTS user_role CASCADE`;
  await sql`DROP TYPE IF EXISTS project_status CASCADE`;
  await sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`;
  console.log("✓ Database reset");
}

main().catch(console.error).finally(() => process.exit(0));
