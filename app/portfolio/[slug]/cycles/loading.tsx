import { SkeletonRows } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonRows label="Loading cycles" cols="70px minmax(0,1fr) 120px 100px 90px" />
  );
}
