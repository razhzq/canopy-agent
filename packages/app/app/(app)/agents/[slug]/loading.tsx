// Shown while the strategy page is being rendered on the server.
//
// Route-level loading covers a window the in-component skeletons cannot: the
// gap between clicking a link and this component existing at all. Without it
// Next holds the PREVIOUS page on screen, so a click appears to do nothing
// until the new route resolves.
import { SkeletonAgentDetail } from "@/components/skeleton";

export default function Loading() {
  return <SkeletonAgentDetail labelKey="loading_strategy" />;
}
