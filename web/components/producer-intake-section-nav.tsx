"use client";

import { useCallback, useState } from "react";

/** Anchor targets must match `<section id="…">` on `/producer/inbox/[projectId]` (intake only — no show-day sections). */
export const PRODUCER_INTAKE_NAV_GROUPS = [
  {
    heading: "Setup",
    items: [
      { id: "booking", label: "Booking & workspace" },
      { id: "intake-summary", label: "Intake summary" },
      { id: "director-invite", label: "Director invite" },
      { id: "proposal", label: "Proposal draft" },
    ],
  },
  {
    heading: "Contracts & billing",
    items: [
      { id: "contracts", label: "Contracts (DocuSign)" },
      { id: "uls-confidential-files", label: "Confidential files" },
      { id: "stripe", label: "Stripe" },
    ],
  },
  {
    heading: "ULS only",
    items: [{ id: "internal", label: "Internal (ULS)" }],
  },
] as const;

const LINK =
  "-mx-1 block rounded-md px-2 py-1.5 text-left text-[13px] leading-snug text-zinc-400 transition hover:bg-zinc-800/90 hover:text-zinc-100";

export function ProducerIntakeSectionNav() {
  const [expanded, setExpanded] = useState(true);

  const jump = useCallback((id: string) => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      {/* Mobile */}
      <details className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950/55 lg:hidden">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-zinc-200 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Jump to section
            <span className="text-xs font-normal text-zinc-500">tap to expand</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-zinc-800/90 px-2 py-3">
          {PRODUCER_INTAKE_NAV_GROUPS.map((g) => (
            <div key={g.heading}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{g.heading}</p>
              <ul className="mt-1.5 space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`w-full ${LINK}`} onClick={() => jump(item.id)}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {/* Desktop: sticky collapsible TOC */}
      <div
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ease-out ${
          expanded ? "w-[13.5rem]" : "w-[2.625rem]"
        }`}
      >
        {!expanded ? (
          <aside className="sticky top-6 flex justify-center rounded-lg border border-zinc-800 bg-zinc-950/90 py-3 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title="Show section navigation"
              aria-label="Show section navigation"
            >
              »
            </button>
          </aside>
        ) : (
          <aside className="sticky top-6 max-h-[min(92vh,calc(100vh-5rem))] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/90 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Sections</span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                title="Hide navigation"
                aria-label="Collapse section navigation"
              >
                «
              </button>
            </div>
            <nav className="space-y-4" aria-label="Intake detail sections">
              {PRODUCER_INTAKE_NAV_GROUPS.map((g) => (
                <div key={g.heading}>
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{g.heading}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {g.items.map((item) => (
                      <li key={item.id}>
                        <a href={`#${item.id}`} className={LINK}>
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </>
  );
}
