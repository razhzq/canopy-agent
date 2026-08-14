import { Suspense } from "react";
import { PublishScreen } from "@/components/publish";
import { SkeletonPanel } from "@/components/skeleton";

/**
 * `PublishScreen` reads `?strategy=` via useSearchParams, which Next requires
 * to sit under a Suspense boundary or the whole route opts out of static
 * rendering at build time.
 */
export default function PublishPage() {
  return (
    <Suspense fallback={<SkeletonPanel label="Loading record" />}>
      <PublishScreen />
    </Suspense>
  );
}
