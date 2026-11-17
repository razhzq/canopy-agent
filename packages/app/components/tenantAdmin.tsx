"use client";

// The tenant's own admin page (canopy-be routes/tenantAdmin.ts).
//
// Only reachable for users in tenant_admins; everyone else gets the
// not-an-admin state, and the API refuses them regardless. English only, like
// the Canopy admin portal: it is an operator surface, not product copy.

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  addTenantAdmin,
  delistTenantStrategy,
  getTenantAdminMe,
  getTenantAdmins,
  getTenantAgents,
  getTenantStrategies,
  getTenantUsers,
  removeTenantAdmin,
  updateTenantSettings,
  uploadTenantAsset,
  type TenantAdminRole,
  type TenantAdminSettings,
  type TenantAssetKind,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { describeError } from "@/lib/errors";
import { ErrorState, SignedOutState } from "@/components/states";
import { SkeletonRows } from "@/components/skeleton";
import { Field, PRIMARY, QUIET, SECONDARY, SURFACE, StatusLine } from "@/components/kit";

type Tab = "settings" | "users" | "agents" | "strategies" | "admins";

const INPUT =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 font-ui text-[13px] pointer-coarse:text-[16px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent/40";

export function TenantAdmin() {
  const me = useApi(getTenantAdminMe, []);
  const [tab, setTab] = useState<Tab>("settings");

  if (me.phase === "signed-out") return <SignedOutState />;
  if (me.phase === "loading") return <SkeletonRows labelKey="loading_agents" cols="2fr 1fr 1fr 1fr" rows={5} />;
  if (me.phase === "error") return <ErrorState message={me.message} onRetry={me.reload} />;
  if (!me.data) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-24 text-center font-ui text-[13px] text-text-secondary">
        This page is for this app&apos;s admins.
      </div>
    );
  }
  const { role, tenant } = me.data;

  return (
    <div className="mx-auto max-w-[960px] px-6 py-14">
      <header className="mb-8">
        <h1 className="font-ui text-[28px] font-light tracking-[-0.02em] text-text-primary">Manage {tenant.name}</h1>
        <p className="mt-1.5 font-ui text-[13px] text-text-muted">
          {tenant.userCount} users · {tenant.agentCount} agents · you are {role === "owner" ? "an owner" : "an admin"}
        </p>
      </header>

      <nav className="mb-8 flex gap-1 border-b border-border">
        {(["settings", "users", "agents", "strategies", "admins"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 pb-2.5 font-ui text-[13px] capitalize transition-colors ${
              tab === t ? "border-accent text-text-primary" : "border-transparent text-text-dim hover:text-text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "settings" && <Settings tenant={tenant} onSaved={me.reload} />}
      {tab === "users" && <Users />}
      {tab === "agents" && <Agents />}
      {tab === "strategies" && <Strategies />}
      {tab === "admins" && <Admins role={role} />}
    </div>
  );
}

const ASSETS: { kind: TenantAssetKind; field: "logoUrl" | "logoInkUrl" | "markUrl" | "faviconUrl"; label: string; light: boolean }[] = [
  { kind: "logo", field: "logoUrl", label: "Logo (in the app)", light: false },
  { kind: "logo-ink", field: "logoInkUrl", label: "Logo on white (landing)", light: true },
  { kind: "mark", field: "markUrl", label: "Mark", light: false },
  { kind: "favicon", field: "faviconUrl", label: "Favicon", light: true },
];

function Settings({ tenant, onSaved }: { tenant: TenantAdminSettings; onSaved: () => void }) {
  const { getAccessToken } = usePrivy();
  const [name, setName] = useState(tenant.name);
  const [accent, setAccent] = useState(tenant.accentColor ?? "#5ED3B3");
  const [ga, setGa] = useState(tenant.gaMeasurementId ?? "");
  const [features, setFeatures] = useState(tenant.features);
  const [assets, setAssets] = useState({
    logoUrl: tenant.logoUrl,
    logoInkUrl: tenant.logoInkUrl,
    markUrl: tenant.markUrl,
    faviconUrl: tenant.faviconUrl,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  async function save(patch: Parameters<typeof updateTenantSettings>[1], label = "save") {
    setBusy(label);
    setNote(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again");
      await updateTenantSettings(token, patch);
      setNote({ tone: "good", text: "Saved. Visitors see it within a couple of minutes." });
      onSaved();
    } catch (err) {
      setNote({ tone: "bad", text: describeError(err) });
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: TenantAssetKind, field: keyof typeof assets, file: File) {
    setBusy(kind);
    setNote(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again");
      const url = await uploadTenantAsset(token, kind, file);
      await updateTenantSettings(token, { [field]: url });
      setAssets((a) => ({ ...a, [field]: url }));
      setNote({ tone: "good", text: "Uploaded." });
    } catch (err) {
      setNote({ tone: "bad", text: describeError(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Accent colour">
          <div className="flex items-center gap-3">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} className="h-10 w-12 rounded-lg border border-border bg-bg" />
            <input value={accent} onChange={(e) => setAccent(e.target.value)} className={`${INPUT} max-w-36 font-mono`} />
            <span className="size-6 rounded-full" style={{ background: accent }} aria-hidden />
          </div>
        </Field>
        <Field label="Google Analytics id">
          <input value={ga} onChange={(e) => setGa(e.target.value.trim())} placeholder="G-XXXXXXX" className={`${INPUT} font-mono`} />
        </Field>
        <Field label="Sections">
          <div className="space-y-2">
            {(["atlas", "earnings"] as const).map((f) => (
              <label key={f} className="flex items-center gap-2.5 font-ui text-[13px] text-text-primary">
                <input type="checkbox" checked={features[f]} onChange={(e) => setFeatures((x) => ({ ...x, [f]: e.target.checked }))} />
                {f === "atlas" ? "Atlas (fund benchmarks)" : "Creator earnings"}
              </label>
            ))}
          </div>
        </Field>
        <button
          className={PRIMARY}
          disabled={busy !== null}
          onClick={() => void save({ name, accentColor: accent, gaMeasurementId: ga || null, features })}
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        {ASSETS.map((a) => {
          const url = assets[a.field];
          return (
            <div key={a.kind} className="space-y-2">
              <p className="font-ui text-[12px] text-text-dim">{a.label}</p>
              <div className={`flex h-20 items-center justify-center rounded-xl border border-border ${a.light ? "bg-white" : "bg-bg"}`}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a remote preview
                  <img src={url} alt="" className="max-h-12 max-w-[85%]" />
                ) : (
                  <span className="font-ui text-[11px] text-text-muted">none</span>
                )}
              </div>
              <label className={`${SECONDARY} cursor-pointer`}>
                {busy === a.kind ? "Uploading…" : url ? "Replace" : "Upload"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                  disabled={busy !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(a.kind, a.field, f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}
      </section>

      {note && <StatusLine tone={note.tone}>{note.text}</StatusLine>}

      <p className="font-ui text-[12px] text-text-muted">
        Login provider, domain and what can trade live are managed by Canopy — ask your Canopy contact to change them.
      </p>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className={`${SURFACE} overflow-x-auto`}>
      <table className="w-full font-ui text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-left text-text-dim">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-text-primary">{children}</tbody>
      </table>
    </div>
  );
}

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

function Users() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const users = useApi((t) => getTenantUsers(t, search), [search]);
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or username" className={`${INPUT} max-w-sm`} />
      </form>
      {users.phase === "ready" ? (
        <>
          <p className="font-ui text-[12px] text-text-dim">{users.data.total} users</p>
          <Table head={["User", "Wallet", "Agents", "Live", "Joined"]}>
            {users.data.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">{u.username ? `@${u.username}` : (u.email ?? `#${u.id}`)}</td>
                <td className="px-4 py-2.5 font-mono text-[11.5px] text-text-dim">
                  {u.wallet_address ? `${u.wallet_address.slice(0, 4)}…${u.wallet_address.slice(-4)}` : "—"}
                </td>
                <td className="px-4 py-2.5 tnum">{u.agents}</td>
                <td className="px-4 py-2.5 tnum">{u.live_agents}</td>
                <td className="px-4 py-2.5 text-text-dim">{date(u.created_at)}</td>
              </tr>
            ))}
          </Table>
        </>
      ) : users.phase === "error" ? (
        <ErrorState message={users.message} onRetry={users.reload} />
      ) : (
        <SkeletonRows labelKey="loading_agents" cols="2fr 1fr 1fr 1fr" rows={5} />
      )}
    </div>
  );
}

function Agents() {
  const agents = useApi((t) => getTenantAgents(t), []);
  if (agents.phase === "error") return <ErrorState message={agents.message} onRetry={agents.reload} />;
  if (agents.phase !== "ready") return <SkeletonRows labelKey="loading_agents" cols="2fr 1fr 1fr 1fr" rows={5} />;
  return (
    <Table head={["Agent", "Owner", "Strategy", "Mode", "Status", "Capital", "Created"]}>
      {agents.data.agents.map((a) => (
        <tr key={a.id}>
          <td className="px-4 py-2.5">{a.name}</td>
          <td className="px-4 py-2.5 text-text-dim">{a.owner_username ? `@${a.owner_username}` : (a.owner_email ?? "—")}</td>
          <td className="px-4 py-2.5 text-text-dim">{a.strategy_name ?? "—"}</td>
          <td className="px-4 py-2.5">{a.is_paper ? "Paper" : "Live"}</td>
          <td className="px-4 py-2.5 capitalize">{a.status}</td>
          <td className="px-4 py-2.5 tnum">
            {a.unit === "SOL" && a.capital_sol ? `${Number(a.capital_sol).toLocaleString()} SOL` : `$${Number(a.capital_usd).toLocaleString()}`}
          </td>
          <td className="px-4 py-2.5 text-text-dim">{date(a.created_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

function Strategies() {
  const { getAccessToken } = usePrivy();
  const strategies = useApi((t) => getTenantStrategies(t), []);
  const [error, setError] = useState<string | null>(null);
  if (strategies.phase === "error") return <ErrorState message={strategies.message} onRetry={strategies.reload} />;
  if (strategies.phase !== "ready") return <SkeletonRows labelKey="loading_agents" cols="2fr 1fr 1fr 1fr" rows={5} />;

  async function delist(id: number, name: string) {
    if (!confirm(`Take "${name}" off the marketplace? Agents already running it keep running.`)) return;
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again");
      await delistTenantStrategy(token, id);
      strategies.reload();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="space-y-4">
      {error && <StatusLine tone="bad">{error}</StatusLine>}
      <Table head={["Strategy", "Author", "Agents", "Status", "Published", ""]}>
        {strategies.data.strategies.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-2.5">{s.name}</td>
            <td className="px-4 py-2.5 text-text-dim">{s.author_username ? `@${s.author_username}` : (s.author_email ?? "—")}</td>
            <td className="px-4 py-2.5 tnum">{s.agents}</td>
            <td className="px-4 py-2.5 capitalize">{s.status}</td>
            <td className="px-4 py-2.5 text-text-dim">{date(s.published_at)}</td>
            <td className="px-4 py-2.5 text-right">
              {s.status === "published" && (
                <button className={QUIET} onClick={() => void delist(s.id, s.name)}>
                  Delist
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Admins({ role }: { role: TenantAdminRole }) {
  const { getAccessToken } = usePrivy();
  const admins = useApi(getTenantAdmins, []);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<TenantAdminRole>("admin");
  const [error, setError] = useState<string | null>(null);
  const owner = role === "owner";

  async function act(fn: (token: string) => Promise<unknown>) {
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sign in again");
      await fn(token);
      admins.reload();
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (admins.phase === "error") return <ErrorState message={admins.message} onRetry={admins.reload} />;
  if (admins.phase !== "ready") return <SkeletonRows labelKey="loading_agents" cols="2fr 1fr 1fr 1fr" rows={5} />;

  return (
    <div className="space-y-5">
      <Table head={["Admin", "Role", "", ""]}>
        {admins.data.admins.map((a) => (
          <tr key={`${a.userId ?? a.email}`}>
            <td className="px-4 py-2.5">{a.username ? `@${a.username}` : (a.email ?? `#${a.userId}`)}</td>
            <td className="px-4 py-2.5 capitalize">{a.role}</td>
            <td className="px-4 py-2.5 text-text-dim">{a.active ? "" : "invited"}</td>
            <td className="px-4 py-2.5 text-right">
              {owner && (
                <button
                  className={QUIET}
                  onClick={() => void act((t) => removeTenantAdmin(t, a.userId ? { userId: a.userId } : { email: a.email! }))}
                >
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {owner ? (
        <div className="flex flex-wrap items-center gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className={`${INPUT} max-w-xs`} />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as TenantAdminRole)} className={`${INPUT} w-auto`}>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <button
            className={SECONDARY}
            disabled={!email}
            onClick={() => void act((t) => addTenantAdmin(t, email, newRole)).then(() => setEmail(""))}
          >
            Add admin
          </button>
        </div>
      ) : (
        <p className="font-ui text-[12px] text-text-muted">Only owners can add or remove admins.</p>
      )}
      {error && <StatusLine tone="bad">{error}</StatusLine>}
      <p className="font-ui text-[12px] text-text-muted">
        Someone without an account becomes an admin the first time they sign in with that email.
      </p>
    </div>
  );
}
