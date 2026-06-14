import { PageSkeleton } from "@/components/skeletons";

// Route-level fallback shown during navigation between app pages.
export default function Loading() {
  return <PageSkeleton />;
}
