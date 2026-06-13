import { db } from "../lib/db";
import { projects, resources, allocations } from "../lib/db/schema";

const PROJECTS = [
  {
    id: "p-website-relaunch",
    name: "Website Relaunch",
    code: "WEB",
    status: "Active" as const,
    priority: 2,
    color: "#1d4ed8",
    startDate: "2026-05-01",
    endDate: "2026-08-31",
    manager: "Sarah Chen",
    budget: "120000",
    tags: ["customer", "web"],
  },
  {
    id: "p-mobile-app",
    name: "Mobile App v2",
    code: "MOB",
    status: "Active" as const,
    priority: 1,
    color: "#9a3412",
    startDate: "2026-04-01",
    endDate: "2026-09-30",
    manager: "James Park",
    budget: "200000",
    tags: ["mobile", "customer"],
  },
  {
    id: "p-data-platform",
    name: "Data Platform",
    code: "DAT",
    status: "Planning" as const,
    priority: 2,
    color: "#3f6212",
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    manager: "Maria Lopez",
    budget: "150000",
    tags: ["internal", "data"],
  },
  {
    id: "p-auth-upgrade",
    name: "Auth & Security Upgrade",
    code: "SEC",
    status: "Active" as const,
    priority: 1,
    color: "#86198f",
    startDate: "2026-05-15",
    endDate: "2026-07-31",
    manager: "Sarah Chen",
    budget: "60000",
    tags: ["internal", "security"],
  },
  {
    id: "p-design-system",
    name: "Design System",
    code: "DS",
    status: "On Hold" as const,
    priority: 3,
    color: "#a16207",
    startDate: "2026-08-01",
    endDate: "2026-11-30",
    manager: "James Park",
    budget: "80000",
    tags: ["internal", "design"],
  },
];

const RESOURCES = [
  {
    id: "r-alice",
    name: "Alice Johnson",
    role: "Senior Frontend Engineer",
    team: "Engineering",
    capacity: "40",
    dayRate: "650",
    tags: ["react", "typescript"],
  },
  {
    id: "r-bob",
    name: "Bob Martinez",
    role: "Backend Engineer",
    team: "Engineering",
    capacity: "40",
    dayRate: "600",
    tags: ["node", "postgres"],
  },
  {
    id: "r-carol",
    name: "Carol White",
    role: "Mobile Engineer",
    team: "Engineering",
    capacity: "40",
    dayRate: "625",
    tags: ["react-native", "ios"],
  },
  {
    id: "r-david",
    name: "David Kim",
    role: "Data Engineer",
    team: "Data",
    capacity: "40",
    dayRate: "700",
    tags: ["python", "spark"],
  },
  {
    id: "r-emma",
    name: "Emma Davis",
    role: "Product Designer",
    team: "Design",
    capacity: "40",
    dayRate: "550",
    tags: ["figma", "ux"],
  },
  {
    id: "r-frank",
    name: "Frank Wilson",
    role: "DevOps Engineer",
    team: "Engineering",
    capacity: "32",
    dayRate: "675",
    tags: ["aws", "terraform"],
  },
  {
    id: "r-grace",
    name: "Grace Lee",
    role: "QA Engineer",
    team: "Engineering",
    capacity: "40",
    dayRate: "500",
    tags: ["automation", "testing"],
  },
  {
    id: "r-henry",
    name: "Henry Brown",
    role: "Senior Backend Engineer",
    team: "Engineering",
    capacity: "40",
    dayRate: "700",
    tags: ["java", "microservices"],
  },
];

const ALLOCATIONS = [
  // Website Relaunch
  { id: "a-1", projectId: "p-website-relaunch", resourceId: "r-alice", hoursPerWeek: "32", startDate: "2026-05-01", endDate: "2026-08-31" },
  { id: "a-2", projectId: "p-website-relaunch", resourceId: "r-emma", hoursPerWeek: "20", startDate: "2026-05-01", endDate: "2026-07-31" },
  { id: "a-3", projectId: "p-website-relaunch", resourceId: "r-bob", hoursPerWeek: "16", startDate: "2026-05-15", endDate: "2026-08-15" },

  // Mobile App v2
  { id: "a-4", projectId: "p-mobile-app", resourceId: "r-carol", hoursPerWeek: "40", startDate: "2026-04-01", endDate: "2026-09-30" },
  { id: "a-5", projectId: "p-mobile-app", resourceId: "r-alice", hoursPerWeek: "8", startDate: "2026-06-01", endDate: "2026-08-31" },
  { id: "a-6", projectId: "p-mobile-app", resourceId: "r-grace", hoursPerWeek: "24", startDate: "2026-05-01", endDate: "2026-09-30" },
  { id: "a-7", projectId: "p-mobile-app", resourceId: "r-emma", hoursPerWeek: "16", startDate: "2026-04-01", endDate: "2026-06-30" },

  // Data Platform
  { id: "a-8", projectId: "p-data-platform", resourceId: "r-david", hoursPerWeek: "40", startDate: "2026-07-01", endDate: "2026-12-31" },
  { id: "a-9", projectId: "p-data-platform", resourceId: "r-henry", hoursPerWeek: "20", startDate: "2026-07-01", endDate: "2026-10-31" },

  // Auth & Security Upgrade
  { id: "a-10", projectId: "p-auth-upgrade", resourceId: "r-henry", hoursPerWeek: "20", startDate: "2026-05-15", endDate: "2026-07-31" },
  { id: "a-11", projectId: "p-auth-upgrade", resourceId: "r-bob", hoursPerWeek: "24", startDate: "2026-05-15", endDate: "2026-07-31" },
  { id: "a-12", projectId: "p-auth-upgrade", resourceId: "r-frank", hoursPerWeek: "16", startDate: "2026-05-15", endDate: "2026-07-15" },

  // Design System
  { id: "a-13", projectId: "p-design-system", resourceId: "r-emma", hoursPerWeek: "32", startDate: "2026-08-01", endDate: "2026-11-30" },
];

async function main() {
  console.log("Seeding sample data…");

  // Insert projects
  for (const p of PROJECTS) {
    await db.insert(projects).values(p).onConflictDoNothing();
  }
  console.log(`✓ ${PROJECTS.length} projects`);

  // Insert resources
  for (const r of RESOURCES) {
    await db.insert(resources).values(r).onConflictDoNothing();
  }
  console.log(`✓ ${RESOURCES.length} resources`);

  // Insert allocations
  for (const a of ALLOCATIONS) {
    await db.insert(allocations).values(a).onConflictDoNothing();
  }
  console.log(`✓ ${ALLOCATIONS.length} allocations`);

  console.log("\nDone! Log in and the data will appear across all views.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
