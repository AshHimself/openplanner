"use client";

import { useState } from "react";
import { Shield, Users, SlidersHorizontal, ListPlus } from "lucide-react";
import { AdminUsers } from "@/components/admin-users";
import { AdminPermissions } from "@/components/admin-permissions";
import { AdminCustomFields } from "@/components/admin-custom-fields";

const TABS = [
  { id: "users", label: "Users & roles", icon: Users },
  { id: "permissions", label: "Permissions", icon: SlidersHorizontal },
  { id: "fields", label: "Custom fields", icon: ListPlus },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Shield className="h-5 w-5" />
          Admin
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage users, role permissions, and custom fields. Admin only.
        </p>
      </div>

      <div className="flex gap-0 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "users" && <AdminUsers />}
      {tab === "permissions" && <AdminPermissions />}
      {tab === "fields" && <AdminCustomFields />}
    </div>
  );
}
