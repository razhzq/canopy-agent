import { SkeletonLog } from "@/components/skeleton";

export default function Loading() {
  return <SkeletonLog label="Loading the trace" rows={6} />;
}
