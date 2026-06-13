import {
  pgTable,
  pgEnum,
  text,
  integer,
  numeric,
  date,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["admin", "planner", "viewer"]);
export const statusEnum = pgEnum("project_status", [
  "Planning",
  "Active",
  "On Hold",
  "Completed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").default("viewer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  status: statusEnum("status").default("Planning").notNull(),
  priority: integer("priority").notNull().default(2), // 1 | 2 | 3
  color: text("color").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  manager: text("manager"),
  budget: numeric("budget"),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resources = pgTable("resources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  team: text("team").notNull(),
  capacity: numeric("capacity").notNull(), // hours per week
  dayRate: numeric("day_rate"),
  avatarUrl: text("avatar_url"),
  tags: text("tags").array().default([]),
});

export const allocations = pgTable("allocations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  resourceId: text("resource_id")
    .references(() => resources.id, { onDelete: "cascade" })
    .notNull(),
  hoursPerWeek: numeric("hours_per_week").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
});

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type Allocation = typeof allocations.$inferSelect;
