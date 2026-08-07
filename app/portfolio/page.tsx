import { redirect } from "next/navigation";

/**
 * Legacy deep link. "Your agents" lived here before wireframe 1j gave the list
 * its own page at /workspace. Two divergent tables of the same agents is worse
 * than one, so this forwards rather than rendering a second, staler one.
 */
export default function PortfolioIndex() {
  redirect("/workspace");
}
