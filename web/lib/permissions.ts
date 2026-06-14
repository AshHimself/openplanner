// Central definition of the RBAC permission model. Roles are fixed
// (viewer / planner / admin); admins edit which permissions each role has via a
// matrix stored in the role_permissions table. These defaults apply when a
// (role, permission) row is absent.

export type Role = "viewer" | "planner" | "admin";
export const ROLES: Role[] = ["viewer", "planner", "admin"];

export type PermissionKey =
  | "admin.access"
  | "users.manage"
  | "permissions.manage"
  | "customfields.manage"
  | "projects.edit"
  | "resources.edit"
  | "allocations.edit"
  | "timesheets.edit"
  | "requirements.edit"
  | "costs.view";

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "admin.access", label: "Access admin panel", description: "Open the Admin section.", group: "Administration" },
  { key: "users.manage", label: "Manage users & roles", description: "Change which role a user has.", group: "Administration" },
  { key: "permissions.manage", label: "Manage permissions", description: "Edit this permission matrix.", group: "Administration" },
  { key: "customfields.manage", label: "Manage custom fields", description: "Add/remove custom fields on resources & projects.", group: "Administration" },
  { key: "projects.edit", label: "Edit projects", description: "Create, edit and delete projects.", group: "Planning" },
  { key: "resources.edit", label: "Edit resources", description: "Create, edit and delete resources.", group: "Planning" },
  { key: "allocations.edit", label: "Edit allocations", description: "Create, edit and delete allocations.", group: "Planning" },
  { key: "timesheets.edit", label: "Edit timesheets", description: "Log and import actual hours.", group: "Planning" },
  { key: "requirements.edit", label: "Edit requirements", description: "Define project resource requirements.", group: "Planning" },
  { key: "costs.view", label: "View costs", description: "See day rates, budgets and forecast costs.", group: "Visibility" },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// Default matrix used when the DB has no override for a (role, permission).
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  admin: ALL_PERMISSION_KEYS,
  planner: [
    "projects.edit",
    "resources.edit",
    "allocations.edit",
    "timesheets.edit",
    "requirements.edit",
    "costs.view",
  ],
  viewer: ["costs.view"],
};

export function defaultHasPermission(role: Role, permission: PermissionKey): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
