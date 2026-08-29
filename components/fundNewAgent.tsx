"use client";

import { useState } from "react";

import { DELEGATION_CEILING_USD, type AgentModel } from "@/lib/api";
import { GrantDelegation } from "@/components/grantDelegation";
import { ModelTopUpForm } from "@/components/modelPanel";
import { ModelBadge } from "@/components/modelBadge";
import { CheckIcon } from "@/components/ui";
import { LABEL, PRIMARY, QUIET, StatusLine } from "@/components/kit";
import type { ModelChoice } from "@/components/pickModel";

/**
 * Switching on an agent that has just been built.
 *
 * ONBOARDING IS NOT MANAGEMENT, AND THIS IS THE SPLIT.
 *
 * This step used to be `ModelPanel` — the owner's standing panel for an agent
 * that has been running a while: balance, spend, tokens used, change the model,
 * top it up. Every one of those is the right thing to show about an agent with
 * a history, and the wrong thing to show about one that is four seconds old.
 * Pointed at a brand-new agent that panel rendered, in this order: a $0.00
 * balance, a $0.00 spend, "no cycles measured yet", "nothing recorded yet", and
 * a WARNING reading "Out of model balance" — which is a sentence about running
 * out, aimed at something that had never been filled. The first thing the
 * product said to someone who had just finished building an agent was that
 * their agent was broken.
 *
 * So the panel keeps the job it was written for and this screen takes the other
 * one. Nothing here reports a figure: a new agent has no history, and rendering
 * the absence of one as data is what produced the warning.
 *
 * BOTH STEPS ARE ON SCREEN FROM THE FIRST FRAME.
 *
 * This is the change that matters most. The old flow showed the delegation
 * ask ALONE; the top-up button did not exist until the grant had landed, so the
 * second wallet signature arrived as a surprise to someone who thought they
 * were done. People who would happily have done two steps abandoned at the
 * first, because nothing told them how deep it went. Step two is drawn from the
 * start, dimmed and unpressable, with its amount already in it.
 *
 * WHY IT IS A SCREEN AND NOT A DIALOG.
 *
 * `buildAgent` RETURNS this instead of the wizard — the builder behind it is
 * finished and every field is already frozen into the deployed agent. A modal
 * over a dead page is a screen wearing a dialog's clothes, and the 420px frame
 * was squeezing two wallet signatures, a bundle picker, a payer picker and a
 * live chain read into a box that then had to compete with its own close
 * button.
 *
 * LEAVING IS A SUPPORTED OUTCOME, NOT AN ESCAPE.
 *
 * The agent is real, deployed and scheduled by the time this renders. An owner
 * who stops here has not broken anything and is not abandoning a transaction —
 * they have an idle agent, which is a state the product is happy to hold. That
 * deserves a sentence and a labelled way out, not an X in a corner.
 *
 * A RAIL, NOT TWO CARDS — kit rules 2 and 3.
 *
 * The first draft put each step in its own bordered card. Inside those cards sit
 * the payer buttons, the three bundle tiles, the amount input and the button
 * that spends: every one of them already bordered, and every one of them
 * actionable. A card around that group is a fifth outline that cannot be
 * pressed, drawn around four that can, which is precisely what rule 3 exists to
 * stop. The sequence is carried by the numbered markers and the hairline
 * threaded through them — structure from spacing and type rather than from
 * boxes, and one less frame between the reader and the control they came for.
 */
export function FundNewAgent({
  agentId,
  agentName,
  model,
  /** The agent's own wallet. Null until delegation is granted — the usual case here. */
  agentWallet,
  personalWallet,
  /** When the agent's mandate ends. The delegation is scoped to the same clock. */
  expiresAt,
  /** Re-read the agent so step two unlocks once the grant lands. */
  onWalletGranted,
  /** Leave for the agent's own page — funded or not. */
  onLeave,
}: {
  agentId: number;
  agentName: string;
  /** The choice made in step 3, carried rather than refetched. */
  model: ModelChoice;
  agentWallet: string | null;
  personalWallet: string | null;
  expiresAt?: string | null;
  onWalletGranted: () => void;
  onLeave: () => void;
}) {
  const [funded, setFunded] = useState<AgentModel | null>(null);
  const hasWallet = agentWallet !== null;

  return (
    <main className="mx-auto w-full max-w-[540px] px-5 py-12 sm:py-20">
      {/* WHAT JUST HAPPENED, FIRST. The agent was built; that is the news, and
          it is news the owner earned. Everything below is the remainder.

          RULE 1: the name is the one thing set large. The model badge under it
          is a chip, the lede is body copy, and the two figures on the steps are
          13px — nothing on this screen competes with the heading. */}
      <header className="space-y-3 pb-10">
        <span className={`block ${LABEL}`}>Built</span>
        <h1 className="font-mono text-[26px] leading-none text-text-primary">
          {agentName}
        </h1>
        <p className="max-w-[50ch] font-ui text-[13.5px] leading-relaxed text-text-secondary">
          {funded
            ? "It has a wallet and a balance. It starts thinking on its next cycle."
            : "It is deployed and on the schedule. Two short steps and it can start thinking."}
        </p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1">
          <ModelBadge
            model={{
              id: model.modelId,
              label: model.label,
              provider: model.provider,
            }}
          />
          <span className="font-ui text-[12px] text-text-dim">
            Bought through Pod · prepaid in USDC
          </span>
        </div>
      </header>

      <ol>
        {/* ─────────────────────────────────────────────────── one: the wallet */}
        <Step
          n={1}
          title="Give it a wallet"
          state={hasWallet ? "done" : "now"}
          // NOT "grant delegation". That is the precise name for the mechanism
          // and the right word at go-live, where the reader has met it. Here it
          // is the first thing standing between someone and a working agent,
          // and naming it after the machinery makes it read as a permission
          // they should think twice about rather than a wallet they are being
          // given.
          body="Its own Solana wallet, separate from yours. The same grant is what
                lets it trade when you take it live, so you are not asked twice."
          connect
        >
          {hasWallet ? (
            // Rule 4: a dot and a word. This is a true, static, unremarkable
            // fact and it gets the quietest treatment that still reads as done.
            <StatusLine tone="good">It has a wallet of its own.</StatusLine>
          ) : (
            <>
              {/* The reassurance sits BESIDE THE BUTTON, which is where
                  hesitation happens. It used to live inside the "out of
                  balance" warning, where the same words read as an excuse for
                  a problem rather than as an answer to the question actually
                  being asked, which is "what is this about to do to my
                  money". */}
              <p className="max-w-[46ch] pb-3.5 font-ui text-[12px] leading-relaxed text-text-dim">
                Nothing moves in this step. The signer is scoped to swaps — it
                cannot touch the balance you add below, and it will never top
                itself up.
              </p>
              <GrantDelegation
                agentId={agentId}
                // See DELEGATION_CEILING_USD: a ceiling, not a budget. What it
                // may spend is what the wallet holds.
                maxSpendUsd={DELEGATION_CEILING_USD}
                expiresAt={
                  expiresAt
                    ? new Date(expiresAt)
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
                idleLabelKey="gd_give_wallet"
                onGranted={onWalletGranted}
              />
            </>
          )}
        </Step>

        {/* ────────────────────────────────────────────────────── two: the money */}
        <Step
          n={2}
          title="Put a balance on it"
          state={funded ? "done" : hasWallet ? "now" : "later"}
          body="Prepaid inference, in USDC. It pays per cycle out of this and pauses
                rather than spending anything you did not put there."
          // The amount decided in step 3 of the builder, stated on the step
          // itself so it is visible while the step is still locked. A step you
          // cannot reach yet is much easier to accept when you can see what it
          // is going to ask for.
          aside={
            model.intendedTopUpUsd !== undefined && !funded
              ? `$${model.intendedTopUpUsd}`
              : undefined
          }
        >
          {funded ? (
            <div className="space-y-1.5">
              <StatusLine tone="good">Funded</StatusLine>
              <p className="font-ui text-[12px] leading-relaxed text-text-dim">
                The balance updates as soon as the network confirms it.
              </p>
            </div>
          ) : hasWallet ? (
            <ModelTopUpForm
              agentId={agentId}
              agentWallet={agentWallet}
              personalWallet={personalWallet}
              // Carried from step 3 rather than asked again from an empty
              // field. See StartingBalance in pickModel for why the question
              // belongs there.
              initialAmountUsd={model.intendedTopUpUsd}
              onDone={setFunded}
            />
          ) : (
            <p className="font-ui text-[12px] leading-relaxed text-text-muted">
              Unlocks once it has a wallet to be credited against.
            </p>
          )}
        </Step>
      </ol>

      {/* ─────────────────────────────────────────────────────────── the exit --
          Rule 5: weighted by consequence, and the escape hatch is quiet text
          beside the action rather than an equal half of a split row. Before
          funding there IS no action here — the action is on step two — so the
          row carries only the sentence and the way out. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-10">
        {funded ? (
          <button type="button" onClick={onLeave} className={PRIMARY}>
            Go to {agentName}
          </button>
        ) : (
          <>
            <p className="max-w-[38ch] font-ui text-[12px] leading-relaxed text-text-dim">
              You can do this later. The agent waits — it will not trade, spend,
              or charge you anything until it has a balance.
            </p>
            <button type="button" onClick={onLeave} className={QUIET}>
              Do this later
            </button>
          </>
        )}
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------- bits -- */

/**
 * One numbered step on the rail, in one of three states.
 *
 * `later` is the load-bearing one and the reason this component exists rather
 * than two hand-written blocks. A step that is not yet reachable must still be
 * DRAWN — full title, full body, and the amount it will ask for — because the
 * entire point is that the owner can see the shape of the whole job before
 * committing to the first part of it. Hiding it until it unlocks is what the
 * old panel did, and it is what made the second signature a surprise.
 *
 * THE MARKER CARRIES THE STATE, so the row does not have to shout it with a
 * border or a fill. A ring for the step you are on, a tick for one that is
 * done, a flat outline for one you cannot reach. Three states, one 24px object,
 * and the copy beside it stays the same weight throughout.
 */
function Step({
  n,
  title,
  body,
  state,
  aside,
  /** Draws the hairline down to the next step. Omitted on the last one. */
  connect = false,
  children,
}: {
  n: number;
  title: string;
  body: string;
  state: "now" | "later" | "done";
  aside?: string;
  connect?: boolean;
  children: React.ReactNode;
}) {
  const dim = state === "later";
  return (
    <li className={`relative pl-9 ${connect ? "pb-9" : ""}`}>
      {/* The rail. It starts below the marker and runs to the next one, so the
          two steps read as one sequence rather than as two unrelated blocks —
          which is the whole job the removed card borders were failing to do. */}
      {connect ? (
        <span
          className="absolute top-7 bottom-0 left-[11.5px] w-px bg-grid"
          aria-hidden
        />
      ) : null}

      <span
        aria-hidden
        className={`absolute top-0 left-0 flex size-6 items-center justify-center rounded-full border text-[10px] transition-colors ${
          state === "done"
            ? "border-accent bg-accent-wash text-accent"
            : state === "now"
              ? "border-accent text-accent"
              : "border-grid text-text-muted"
        }`}
      >
        {state === "done" ? (
          <CheckIcon className="size-3" />
        ) : (
          <span className="tnum font-mono">{n}</span>
        )}
      </span>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className={`font-mono text-[13px] leading-6 transition-colors ${
              dim ? "text-text-muted" : "text-text-primary"
            }`}
          >
            {title}
          </h2>
          {/* Rule 9. It is a figure, and it is compared against the bundle the
              owner picked two screens ago. */}
          {aside ? (
            <span
              className={`tnum shrink-0 font-mono text-[13px] leading-6 transition-colors ${
                dim ? "text-text-muted" : "text-text-secondary"
              }`}
            >
              {aside}
            </span>
          ) : null}
        </div>
        <p
          className={`max-w-[46ch] font-ui text-[12.5px] leading-relaxed transition-colors ${
            dim ? "text-text-muted" : "text-text-dim"
          }`}
        >
          {body}
        </p>
      </div>

      <div className="pt-4">{children}</div>
    </li>
  );
}
