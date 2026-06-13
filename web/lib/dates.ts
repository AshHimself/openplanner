import type { Allocation } from "@/lib/types";

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getWeeks(count: number, from: Date = new Date()): Date[] {
  const first = startOfWeek(from);
  return Array.from({ length: count }, (_, i) => addWeeks(first, i));
}

export function formatWeek(weekStart: Date): string {
  return weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function allocationHoursInWeek(alloc: Allocation, weekStart: Date): number {
  const weekEnd = addDays(weekStart, 6);
  const start = parseISO(alloc.startDate);
  const end = parseISO(alloc.endDate);
  return start <= weekEnd && end >= weekStart ? alloc.hoursPerWeek : 0;
}
