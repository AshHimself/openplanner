import { pgTable, pgEnum, text, integer, numeric, date, timestamp, uuid, index, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";

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
  customFields: jsonb("custom_fields").default({}),
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
  customFields: jsonb("custom_fields").default({}),
});

// RBAC — fixed roles (viewer/planner/admin) with an admin-editable permission
// matrix. A row enables one permission for one role; absent rows fall back to
// the code-defined defaults.
export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: text("role").notNull(), // "viewer" | "planner" | "admin"
    permission: text("permission").notNull(),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })]
);

// Admin-defined custom fields attached to Resources or Projects.
export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(), // "resource" | "project"
  key: text("key").notNull(), // stable slug used in the customFields jsonb
  label: text("label").notNull(),
  type: text("type").notNull(), // "text" | "number" | "date" | "select"
  options: text("options").array().default([]), // for select
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
