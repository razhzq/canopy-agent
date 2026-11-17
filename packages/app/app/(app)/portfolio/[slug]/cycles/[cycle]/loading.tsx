import { SkeletonLog } from "@/components/skeleton";

export default function Loading() {
  return <SkeletonLog labelKey="loading_trace" rows={6} />;
}
