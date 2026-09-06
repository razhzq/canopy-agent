# Build flow — UX and micro-interaction review

Reviewed 2026-09-05 against `DESIGN_PRINCIPLES.md`. Scope: from "Create agent"
to the moment the new agent's workspace opens, plus the publish stage. This is
an assessment; nothing here has been changed yet.

## The flow as it exists

```
Create agent (nav)  ──►  /build/new
  NameAgentModal              "Name your agent" — one field, blocking modal
  01 Market      PickMarket   search / class / venue filters, paged list, or a discovery screen
  02 Limits      SetLimits    write a sentence → compiler → chips; or preset; or hand-edit
  03 Model       PickModel    Canopy-hosted vs a Pod model (search, per-cycle cost)
  Run on paper   submit()     createStrategy → (warnings?) → startPaperRun
                              Pod model → FundNewAgent (wallet grant, top-up) → workspace
                              Canopy model → workspace
Later:            /build/new/publish?strategy=  record so far → publish to marketplace
```

Alongside it, five static wireframe routes still exist under `/deploy/*`
(describe, constraints, autonomy, wallet, fund) with hard-coded "alpha_hunter"
data and no state. Two live buttons still link to them.

## Findings, ordered by how much they cost a user

### 1. Two live buttons lead into the fixture wireframes
- `components/strategyDetail.tsx:392` "Deploy this" → `/deploy/describe?strategy=N`.
  The page never reads the param and renders "alpha_hunter" with a static
  mandate. The marketplace's one call to action ends on a mock.
- `components/publish.tsx:211` links the same way; `components/agentDetailMobile.tsx:564`
  links to `/deploy/fund?agent=N`, also static.
- Fix direction: route Deploy into the real builder pre-seeded from the
  strategy (markets, rules, exits from `getStrategy`), and delete or 404 the
  `/deploy/*` routes so a bookmark cannot land on a mock.

### 2. Nothing survives a refresh
- `components/buildAgent.tsx:151–171`: name, step, markets, limits, model and
  the compiler conversation are all `useState`. A refresh, a tab close, or an
  accidental back at step 3 loses ten minutes of work. Nothing warns before
  navigating away.
- The landing page promises "Draft · autosaved" and the header reads "New
  draft"; the builder does not autosave.
- Fix direction: persist the wizard's state to `localStorage` keyed by user,
  restore on mount with a "Resume where you left off?" line, and add a
  `beforeunload` guard once anything has been entered. Show a quiet
  "Saved" tick beside the name when the snapshot lands.

### 3. The steps swap with no motion and no scroll reset
- Zero transitions across `buildAgent`, `pickMarket`, `setLimits`,
  `pickModel`. Pressing Continue replaces one form with another in the same
  frame; the eye has no cue that it moved forward.
- No `scrollTo` on step change: a long limits step leaves the reader mid-page
  when the model step appears.
- Fix direction: slide the step content 12px from the right with a 200ms fade
  on the shared easing, reverse on Back; scroll the main column to top on
  change; animate the step pill's fill sliding between segments rather than
  jumping. Reduced motion gets a fade only.

### 4. The name is asked before anything is known
- `NameAgentModal` blocks the whole page before the reader has seen a market
  or a rule. People name things after they know what they are; here it is a
  wall with an empty field, and Cancel throws them back to wherever they were.
- The name is then editable inline in the header (`buildAgent.tsx:731`), which
  proves it never needed a modal.
- Fix direction: drop the modal. Open on step 1 with the header name
  pre-filled ("Untitled agent") and the caret in the search box. Ask for the
  name once at the review, pre-suggested from the choice ("SOL dip buyer"),
  where it costs one edit rather than a decision.

### 5. The primary action is off to the side and the gate is a warning
- The Continue button lives in the right rail (`buildAgent.tsx:976–1040`), not
  under the content the reader is acting on; on wide screens it is 800px from
  the market list.
- The disabled state explains itself with amber uppercase mono under the
  button ("Pick a market first") — a hint styled as a warning, so the page
  opens looking like something has already gone wrong.
- Two strings are untranslated literals: "Continue to model" and "Turn on at
  least one rule" (`buildAgent.tsx:1000, 1010`).
- Fix direction: a sticky footer bar under the main column with Back (quiet)
  and Continue (white pill), and the gate as a quiet sentence, or better, the
  button label itself: "Pick a market to continue".

### 6. The compiler's wait has no shape
- After Compile, the only feedback is a 9.5px uppercase "Reading it…" row
  (`setLimits.tsx:~560`) at the foot of the transcript, and the textarea
  clears instantly. A 5–15s model call reads as a hang.
- The result then lands all at once: transcript turns, chips, checklist,
  notes, and a follow-up question, with no order of arrival.
- Fix direction: keep the sent sentence visible as a bubble, show staged
  status with the real pipeline stages as the workspace chat does
  ("Reading… Drafting rules…"), then reveal in sequence: the reading, the
  rule chips entering one by one (60ms stagger, each lighting its On state),
  then the checklist, then the question chips. Disable Compile while busy and
  show the button as "Compiling…" with a spinner.

### 7. The limits step is three products in one column
- Write / Preset toggle, a chat transcript, question chips, a checklist of
  "before you trade" requirements, then (after the first compile) eleven rule
  rows with slider + number + toggle, exits, a scale-out ladder, an
  accumulation card, and timeframe pills. The rail summary duplicates the
  exits and position cap.
- The rule rows only appear after a compile or a manual "set by hand" click,
  so the page's shape changes underneath the reader.
- Fix direction: make the compile result the primary object, as a readable
  strategy card ("Buy SOL when it drops 5% in a day, up to $500, stop −12%,
  take profit +6%") with the raw rules collapsed under "Fine-tune". Keep the
  transcript as a rail, not the main column. Sliders should show their
  consequence live: "−5% → fired 11 times in the last 30 days" from the
  discovery screen count, so a number means something before Continue.

### 8. The market picker has keyboard smarts but hides them
- `/`, arrows and Enter all work (`pickMarket.tsx:~265–315`), and nothing on
  screen says so. The cursor row has no visible highlight distinct from hover.
- Selecting a market gives no confirmation beyond a row state; the rail's
  "Your agent so far" updates silently 800px away.
- Fix direction: a `/` hint inside the search field, a visible focus row, and
  a small pop on the rail's market line when it changes (a 200ms highlight
  wash). Show the chosen markets as removable chips above the list so the
  selection is where the hand is.

### 9. "Run on paper" is the biggest button on the page and says nothing about time
- One label, "Starting…", covers two requests and a possible warnings
  round-trip (`buildAgent.tsx:186–297`). A Pod model then swaps the whole
  page for the funding screen with no transition.
- Warnings arrive as a red callout titled "Check plan" with "Start anyway" and
  "Go back and edit" pills; the destructive-looking colour is on advice, not
  an error.
- Fix direction: stage the button ("Saving strategy… Starting the run…"),
  then a short confirmation frame ("SOL dip buyer is on paper") before the
  workspace or the funding steps slide in. Warnings in the amber tone, with
  "Start anyway" as the quiet option and "Go back" as the primary.

### 10. The funding hand-off is good, and stops short
- `FundNewAgent` is the best screen in the flow: two steps drawn from the
  first frame, the second dimmed until the first lands, reassurance beside
  the button, an honest "Do this later" exit.
- It renders `@/components/kit` labels in the old register (`LABEL`,
  mono title), copy is hard-coded English (not in i18n), and the wallet grant
  completing gives no moment: step 1 turns green and step 2 undims in the
  same frame.
- Fix direction: on grant, run the step marker's tick in, then undim step 2
  200ms later; auto-focus the amount field. Move copy to i18n.

### 11. The step pill and the rail disagree about what "done" means
- The header pill lets you click back to earlier steps; the rail's Trail marks
  "Paper run" and "Publish" as steps you can never reach from here
  (`buildAgent.tsx:815–870`). Two progress systems on one screen.
- Fix direction: one progress control, the header pill, with three steps. The
  rail becomes only "Your agent so far", the review of decisions made.

### 12. Small frictions
- `PickModel` copy is hard-coded English and long; the "Buy a model" card
  silently selects the first Pod model when clicked.
- The name field in the header has no save feedback and blurs to "Untitled".
- Mobile has a proper review screen (`BuildReview`); desktop has none. The
  rail is a partial review with no "edit" affordances per row.
- The Publish page uses a lifecycle `StepBar` (Draft · Paper run · Published)
  that the builder itself no longer shows, so a reader meets it for the first
  time on the last screen.

## Where the micro-interactions should go

| Moment | Interaction |
|---|---|
| Entering the builder | Step 1 fades in; caret already in the market search |
| Selecting a market | Row check ticks in; a chip appears above the list; rail line pulses once |
| Continue | Content slides forward 12px with a fade; step pill fill glides to the next segment; column scrolls to top |
| Back | The same, reversed |
| Compile | Sentence stays as a bubble; staged status; rule chips enter one by one, lighting On |
| Adjusting a slider | The number entry updates live; a one-line consequence below it updates with the value |
| Toggling a rule | The row's figure dims or brightens; the rail's rule count ticks |
| Run on paper | Button stages its label; a confirmation frame; funding steps slide in |
| Wallet granted | Step 1's marker ticks in; step 2 undims after a beat; amount field focused |
| Leaving with unsaved work | A `beforeunload` guard and, on return, a resume line |

## Suggested order of work

1. ~~Fix the dead ends (finding 1) and add persistence with a resume line (2).~~ Done 2026-09-05.
2. ~~Replace the naming modal and move the primary action under the content (4, 5).~~ Done 2026-09-05:
   the builder opens on a naming moment — one large field with the caret in it,
   the market step dimmed beneath; Enter hands the name to the header and
   focuses the market search ("Name it later" skips, and a name is suggested on
   reaching the model step) — and the primary action is a sticky footer
   under the content with the gate as the button label. The rail is now only
   "Your agent so far" (11, first half).
3. ~~Step transitions, scroll reset, step-pill motion (3, 11).~~ Done 2026-09-05:
   step content enters 12px from the direction of travel over 220ms (fade only
   under reduced motion), the column scrolls to top on change, and the step
   pill's fill glides between segments. One progress control remains.
4. ~~The compiler's wait and reveal, and the readable strategy card (6, 7).~~ Done 2026-09-06:
   the sent sentence stays as a bubble; a live status names the stage
   (reading → drafting → checking, paced); Compile shows a spinner and
   "Compiling…"; the result arrives in sequence — strategy card, ledger,
   Fine-tune toggle, checklist, question chips; the raw rules, accumulation
   and timing fold under "Fine-tune the rules" (open by default when set by
   hand). Not done: the live slider consequence ("fired 11 times in 30 days"),
   which needs the discovery screen's count wired to the rule.
5. ~~Market picker selection feedback and hints (8).~~ Done 2026-09-06: a `/`
   key cap inside the search pill (hidden on focus); the cursor row is a
   surface with a hairline at its edge, a chosen row is a green tick in place
   of the logo; chosen markets stand above the list as removable chips; the
   rail's market line pulses once when it changes; filters and headers in the
   running register.
6. ~~Run-on-paper staging and the funding hand-off polish (9, 10).~~ Done 2026-09-06:
   the button stages ("Saving the strategy…", "Starting the run…") with a
   spinner; a 1.3s confirmation frame ("SOL dip buyer is on paper") precedes
   the workspace or the funding steps; in FundNewAgent the grant landing ticks
   step one in, undims step two 260ms later and focuses the amount field; its
   copy is in i18n (en + zh) and the headings are in the running register.
7. ~~Copy to i18n and the remaining small frictions (12).~~ Done 2026-09-06:
   PickModel's copy is in i18n (en + zh) and cut to one line with the rest
   behind dots; "Buy a model" opens the catalogue and focuses its search
   instead of silently picking the first row; the catalogue hides while the
   included model is chosen; the Pod terms are three lines with dots; the
   publish page's lifecycle StepBar is gone. Still open: a desktop review with
   per-row edit affordances (the rail is the summary; the footer is the action).
