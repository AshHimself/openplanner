import "dotenv/config";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { users } from "../lib/db/schema";
import bcrypt from "bcryptjs";

const db = drizzle(sql);

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const [user] = await db
    .insert(users)
    .values({ email: EMAIL, name: "Admin", passwordHash: hash, role: "admin" })
    .onConflictDoNothing()
    .returning({ id: users.id, email: users.email, role: users.role });

  if (user) {
    console.log("✓ Admin created:", user.email);
  } else {
    console.log("— User already exists, skipped.");
  }
}

main().catch(console.error).finally(() => process.exit(0));
