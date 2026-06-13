import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  if (existing.length > 0) {
    console.log(`Admin user ${EMAIL} already exists.`);
    process.exit(0);
  }

  const [user] = await db
    .insert(users)
    .values({ email: EMAIL, name: "Admin", passwordHash: hash, role: "admin" })
    .returning();

  console.log(`Created admin user: ${user.email}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
