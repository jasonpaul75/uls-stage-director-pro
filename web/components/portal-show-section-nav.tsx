"use client";

import { useCallback, useState } from "react";

import type { PortalShowNavItem } from "@/lib/portal-show-section-nav";

type Props = { items: PortalShowNavItem[] };

const LINK =
  "-mx-1 block rounded-md px-2 py-1.5 text-left text-[13px] leading-snug text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100";

/** Director show workspace TOC — skips render when items empty. */
export function PortalShowSectionNav({ items }: Props) {
  const [expanded, setExpanded] = useState(true);

  const jump = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <details className="mb-6 rounded-lg border border-neutral-800 bg-neutral-950/55 lg:hidden">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-neutral-200 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Jump to section
            <span className="text-xs font-normal text-neutral-500">tap</span>
          </span>
        </summary>
        <ul className="space-y-0.5 border-t border-neutral-800/90 px-2 py-3">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className={`w-full ${LINK}`} onClick={() => jump(item.id)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <div
        className={`hidden shrink-0 transition-[width] duration-200 ease-out lg:block ${
          expanded ? "w-[13.5rem]" : "w-[2.625rem]"
        }`}
      >
        {!expanded ? (
          <aside className="sticky top-6 flex justify-center rounded-lg border border-neutral-800 bg-neutral-950/90 py-3 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-lg text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
              title="Show section navigation"
              aria-label="Show section navigation"
            >
              »
            </button>
          </aside>
        ) : (
          <aside className="sticky top-6 max-h-[min(92vh,calc(100vh-5rem))] overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/90 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Sections</span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                title="Hide navigation"
                aria-label="Collapse section navigation"
              >
                «
              </button>
            </div>
            <nav className="space-y-1" aria-label="Show workspace sections">
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className={LINK}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>
    </>
  );
}
