import { sql } from "@vercel/postgres";

async function main() {
  await sql`DROP TABLE IF EXISTS allocations CASCADE`;
  await sql`DROP TABLE IF EXISTS resources CASCADE`;
  await sql`DROP TABLE IF EXISTS projects CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  await sql`DROP TYPE IF EXISTS role CASCADE`;
  await sql`DROP TYPE IF EXISTS status CASCADE`;
  console.log("All tables dropped.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
