import { pgTable, pgEnum, text, integer, numeric, date, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["viewer", "planner", "admin"]);
export const statusEnum = pgEnum("status", ["Planning", "Active", "On Hold", "Completed"]);

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
  priority: integer("priority").notNull().default(2),
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
  capacity: numeric("capacity").notNull(),
  dayRate: numeric("day_rate"),
  avatarUrl: text("avatar_url"),
  tags: text("tags").array().default([]),
  // Availability window — when this person joins / leaves (e.g. contractors,
  // new hires). Null = always available.
  startDate: date("start_date"),
  endDate: date("end_date"),
});

export const allocations = pgTable("allocations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  resourceId: text("resource_id").references(() => resources.id, { onDelete: "cascade" }).notNull(),
  hoursPerWeek: numeric("hours_per_week").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
});

export const projectRequirements = pgTable("project_requirements", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  fte: numeric("fte").notNull(),
  tags: text("tags").array().default([]),
});

export const timesheetEntries = pgTable(
  "timesheet_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    resourceId: text("resource_id").references(() => resources.id, { onDelete: "set null" }),
    weekOf: date("week_of").notNull(),
    hoursLogged: numeric("hours_logged").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("ts_project_week_idx").on(t.projectId, t.weekOf)]
);
