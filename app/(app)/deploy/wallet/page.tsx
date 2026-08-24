import { DEPLOY_STEPS } from "@/lib/data";
import { deployCopy } from "@/lib/deployCopy";
import { getServerLocale } from "@/lib/i18n/server";
import {
  AgentTile,
  BlockIcon,
  Columns,
  GhostButton,
  InfoIcon,
  LockIcon,
  PrimaryButton,
  RailRow,
  RailSection,
  SectionHead,
  WarnIcon,
} from "@/components/ui";
import { Proceed, StepBar, WizardHeader } from "@/components/wizard";

/** The mock wallet. An address is an address in any language. */
const ADDRESS = "7xKX…9mQt";
const BALANCE = "$5,240.00";

/**
 * The message body shown in the signing preview.
 *
 * Deliberately NOT translated: it is a literal payload, rendered exactly as it
 * would be signed. Translating a signature's contents would show the reader
 * something other than what their wallet is about to show them.
 */
const PAYLOAD: [string, string][] = [
  ["grantee:", "alpha_hunter"],
  ["spend_cap:", "2000.00 USDC"],
  ["per_tx:", "300.00 USDC"],
  ["venue:", "jupiter_v6"],
  ["expires:", "2026-10-25T00:00Z"],
  ["revocable:", "true"],
  ["wallet:", "7xKX…9mQt"],
  ["nonce:", "8f21c4d9"],
];

export default async function WalletPage() {
  const c = deployCopy(await getServerLocale());
  const d = c.wallet;
  const data = c.walletData;

  return (
    <main>
      <StepBar steps={DEPLOY_STEPS} current={3} />

      <WizardHeader
        eyebrow={d.eyebrow}
        title={d.title}
        meta={[
          { label: c.agentLabel, value: "alpha_hunter" },
          { label: c.capitalLabel, value: c.mandate.capital },
          { label: c.custodyLabel, value: d.custodyValue, tone: "accent" },
        ]}
      />

      <Columns
        main={
          <>
            {/* ---------------------------------------------- source wallet */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="01" title={d.secSource} note={data.provider} />

              <div className="flex items-center justify-between border border-grid bg-panel p-5">
                <div className="flex items-center gap-4">
                  <AgentTile size={40} />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[15px] text-text-primary">{ADDRESS}</p>
                    <p className="font-mono text-[10px] tracking-[0.08em] text-text-dim uppercase">
                      {d.ownedByYou}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {d.balance}
                    </span>
                    <span className="tnum font-mono text-[17px] text-text-primary">{BALANCE}</span>
                  </div>
                  <button
                    type="button"
                    className="border border-border px-4 py-2.5 font-mono text-[10px] tracking-[0.1em] text-text-secondary uppercase transition-colors hover:text-text-primary"
                  >
                    {d.change}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <div className="w-0.5 shrink-0 self-stretch bg-accent" />
                <div className="flex gap-3 pl-1">
                  <LockIcon className="mt-0.5 shrink-0 text-accent" />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                      {d.keysTitle}
                    </p>
                    <p className="max-w-[820px] font-ui text-[13px] leading-relaxed text-text-secondary">
                      {d.keysBody}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ----------------------------------------------------- scope */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="02" title={d.secScope} note={d.secScopeNote} />

              <div className="grid grid-cols-[minmax(0,1fr)_auto_130px] items-center gap-6 border-b border-grid pb-3.5 font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                <span>{d.colParameter}</span>
                <span className="text-right">{d.colValue}</span>
                <span>{d.colEnforcedBy}</span>
              </div>

              {data.scope.map(([param, value, by, tone]) => (
                <div
                  key={param}
                  className="grid grid-cols-[minmax(0,1fr)_auto_130px] items-center gap-6 border-b border-grid py-5"
                >
                  <span className="font-mono text-[13px] text-text-secondary">{param}</span>
                  <span className="tnum text-right font-mono text-[13px] text-text-primary">
                    {value}
                  </span>
                  <span
                    className={`justify-self-start border px-2 py-1.5 font-mono text-[10px] tracking-[0.08em] uppercase ${
                      tone === "warning"
                        ? "border-warning text-warning"
                        : "border-accent text-accent"
                    }`}
                  >
                    {by}
                  </span>
                </div>
              ))}

              <div className="mt-6 flex gap-3">
                <InfoIcon className="mt-0.5 shrink-0 text-text-dim" />
                <p className="max-w-[900px] font-ui text-[13px] leading-relaxed text-text-secondary">
                  {data.scopeNote}
                </p>
              </div>
            </section>

            {/* ------------------------------------------------ impossible */}
            <section className="border-b border-grid px-5 sm:px-8 py-8">
              <SectionHead index="03" title={d.secImpossible} note={d.secImpossibleNote} />
              {data.impossible.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 border-b border-grid py-5 last:border-b-0"
                >
                  <BlockIcon className="mt-0.5 shrink-0 text-negative" />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[13px] text-text-primary">{item.title}</p>
                    <p className="font-ui text-[13px] text-text-dim">{item.body}</p>
                  </div>
                </div>
              ))}
            </section>

            {/* ------------------------------------------------ revocation */}
            <section className="px-5 sm:px-8 py-8">
              <SectionHead index="04" title={d.secRevocation} note={d.secRevocationNote} />
              <p className="pb-6 font-ui text-[14px] text-text-secondary">{d.revocationIntro}</p>

              <div className="flex border border-grid">
                {data.revocation.map((r) => (
                  <div
                    key={r.where}
                    className="flex-1 space-y-3 border-r border-grid p-6 last:border-r-0"
                  >
                    <p className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                      {r.where}
                    </p>
                    <p className="font-mono text-[14px] text-accent">{r.action}</p>
                    <p className="font-ui text-[13px] leading-relaxed text-text-secondary">
                      {r.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex gap-4">
                <div className="w-0.5 shrink-0 self-stretch bg-warning" />
                <div className="flex gap-3 pl-1">
                  <WarnIcon className="mt-0.5 shrink-0 text-warning" />
                  <div className="space-y-1.5">
                    <p className="font-mono text-[12px] tracking-[0.06em] text-text-primary uppercase">
                      {data.revocationWarning.title}
                    </p>
                    <p className="max-w-[820px] font-ui text-[13px] leading-relaxed text-text-secondary">
                      {data.revocationWarning.body}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        }
        rail={
          <>
            <RailSection title={d.grantSummary}>
              {data.grantSummary.map(([k, v, tone]) => (
                <RailRow key={k} label={k} value={v} tone={tone} />
              ))}
            </RailSection>

            <RailSection title={d.youWillSign} note={d.youWillSignNote}>
              <div className="mt-3 border border-grid bg-panel p-5">
                <p className="pb-4 font-mono text-[12px] text-accent">{d.payloadTitle}</p>
                <div className="space-y-2">
                  {PAYLOAD.map(([k, v]) => (
                    <div key={k} className="flex gap-3 font-mono text-[11.5px]">
                      <span className="w-[86px] shrink-0 text-text-dim">{k}</span>
                      <span className="text-text-secondary">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4">
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-dim uppercase">
                  {d.humanReadable}
                </span>
                <button
                  type="button"
                  className="font-mono text-[10px] tracking-[0.1em] text-accent uppercase"
                >
                  {d.viewRaw}
                </button>
              </div>
            </RailSection>

            <Proceed
              step={4}
              total={5}
              primary={
                <PrimaryButton href="/deploy/fund">
                  <SignGlyph /> {d.reviewInWallet}
                </PrimaryButton>
              }
              secondary={
                <GhostButton href="/deploy/autonomy">{d.backToAutonomy}</GhostButton>
              }
              note={d.proceedNote}
            />
          </>
        }
      />
    </main>
  );
}

function SignGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="9"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M2.5 6.5h11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
