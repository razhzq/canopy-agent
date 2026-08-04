"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Agents", href: "/agents", match: ["/agents", "/deploy"] },
  { label: "Portfolio", href: "/portfolio", match: ["/portfolio"] },
  { label: "Build", href: "/build", match: ["/build"] },
];

function CanopyMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden>
      <path
        d="M12 2.6 5.4 9.1h3.1L4.2 13.6h4.1l-3 3.4h5.5V21h2.4v-4h5.5l-3-3.4h4.1l-4.3-4.5h3.1L12 2.6Z"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-8">
      <div className="flex items-center gap-6">
        <Link href="/agents" className="flex items-center gap-2.5">
          <CanopyMark />
          <span className="font-ui text-[19px] font-semibold tracking-tight text-text-primary">
            Canopy
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.match.some((m) => pathname.startsWith(m));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-md bg-surface-2 px-3.5 py-1.5 font-ui text-[15px] font-medium text-text-primary"
                    : "rounded-md px-3.5 py-1.5 font-ui text-[15px] text-text-secondary transition-colors hover:text-text-primary"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex h-9 w-[300px] items-center gap-2.5 rounded-md border border-border bg-panel px-3">
          <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
            <circle
              cx="7"
              cy="7"
              r="4.5"
              fill="none"
              stroke="var(--color-text-dim)"
              strokeWidth="1.4"
            />
            <path
              d="M10.5 10.5 14 14"
              stroke="var(--color-text-dim)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            placeholder="Search agents"
            className="w-full bg-transparent font-ui text-[14px] text-text-primary outline-none placeholder:text-text-dim"
          />
        </label>

        <Link
          href="/build/new"
          className="flex h-9 items-center gap-2 rounded-md bg-accent px-4 font-ui text-[14px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          <span className="text-[16px] leading-none">+</span>
          Create agent
        </Link>

        <div className="size-9 rounded-full bg-surface-2" />
      </div>
    </header>
  );
}
