import { redirect } from "next/navigation";

/**
 * "My agents" — retired, and pointed at the portfolio.
 *
 * This page and /portfolio had drifted into answering one question. Its own
 * docblock said it existed to answer "what is all of my capital doing right
 * now", which is the portfolio question — and /portfolio answers it with an
 * aggregate curve, where the capital sits, the open book and what settled,
 * before listing the same agents underneath.
 *
 * What was genuinely only here has moved rather than been dropped. The count of
 * agents wanting you belongs in the notification centre, which already carries
 * `proposal`, `breach`, `risk_hold` and `state_change` and is reachable from
 * both the desktop bell and the mobile Alerts tab. Pause and resume are now the
 * status badge on each portfolio row.
 *
 * A REDIRECT RATHER THAN A DELETION. This route was the owner's landing page
 * for a long time; it is in bookmarks, in old notification links and in
 * whatever anybody pasted to a teammate. /workspace/:id is untouched and is
 * still where a row goes.
 */
export default function WorkspacePage() {
  redirect("/portfolio");
}
