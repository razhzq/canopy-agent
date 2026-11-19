"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenant } from "@canopy-agent/shared/tenant/context";
import { FOCUS } from "@/components/kit";
import { HOME_ROUTE } from "@/lib/enabledSections";
import { SECTIONS, sectionFor } from "./sections";

/** The left rail on desktop: the mark, then the six sections. */
export function Rail() {
  const pathname = usePathname() ?? "";
  const tenant = useTenant();
  const active = sectionFor(pathname)?.key;
  const mark = tenant.isPlatform ? "/brand/canopy-icon-inverse.svg" : (tenant.brand.markUrl ?? tenant.brand.logoUrl);
  return (
    <nav
      aria-label="Main"
      className="sticky top-2 hidden h-[calc(100dvh-16px)] w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-border bg-panel py-3.5 lg:flex"
    >
      <Link href={HOME_ROUTE} aria-label={tenant.name} className={`mb-3 flex h-8 items-center rounded-md ${FOCUS}`}>
        {mark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mark} alt="" className="h-7 w-auto" />
        ) : (
          <span className="font-ui text-[15px] text-text-primary">{tenant.name.slice(0, 1)}</span>
        )}
      </Link>
      {SECTIONS.map((s) => {
        const on = s.key === active;
        const Icon = s.icon;
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={on ? "page" : undefined}
            className={`flex w-[60px] flex-col items-center gap-1 rounded-xl py-2 font-ui text-[11px] transition-colors ${FOCUS} ${
              on ? "bg-surface-2 font-medium text-text-primary" : "text-text-dim hover:bg-surface hover:text-text-primary"
            }`}
          >
            <Icon className="size-5" strokeWidth={1.6} aria-hidden />
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The same six sections as a bottom bar below lg. */
export function BottomBar() {
  const pathname = usePathname() ?? "";
  const active = sectionFor(pathname)?.key;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-panel/95 px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)] supports-[backdrop-filter]:backdrop-blur-md lg:hidden"
    >
      <ul className="flex">
        {SECTIONS.map((s) => {
          const on = s.key === active;
          const Icon = s.icon;
          return (
            <li key={s.key} className="min-w-0 flex-1">
              <Link
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 font-ui text-[10.5px] ${FOCUS} ${on ? "text-text-primary" : "text-text-muted"}`}
              >
                <Icon className="size-5" strokeWidth={on ? 1.9 : 1.6} aria-hidden />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
