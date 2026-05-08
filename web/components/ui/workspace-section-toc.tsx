"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

export type WorkspaceTocGroup = {
  /** When omitted or blank, the group heading row is not rendered (flat lists). */
  heading?: string | null;
  items: readonly { id: string; label: string }[];
};

const glassTocCard =
  "rounded-2xl border border-white/[0.08] bg-uls-surface/30 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_12px_40px_rgb(0_0_0/0.35)] backdrop-blur-xl transition-[box-shadow,border-color] duration-200 ease-out";

const tocLinkClass =
  "-mx-1 flex min-h-11 w-full items-center rounded-xl px-2 text-left text-[13px] leading-snug text-uls-muted transition-colors hover:bg-white/[0.06] hover:text-uls-text lg:min-h-0 lg:py-1.5";

function TocNavLink(props: {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const { href, className, children, onNavigate } = props;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onNavigate?.();
  };

  return (
    <Link href={href} onClick={onClick} className={cn(tocLinkClass, className)}>
      {children}
    </Link>
  );
}

function TocGroupsContent(props: {
  groups: readonly WorkspaceTocGroup[];
  getHref: (sectionId: string) => string;
  onNavigate?: () => void;
}) {
  const { groups, getHref, onNavigate } = props;

  return (
    <>
      {groups.map((g, gi) => (
        <div key={`toc-group-${gi}`} className={gi > 0 ? "mt-4" : ""}>
          {g.heading?.trim() ? (
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-uls-subtle lg:px-1">{g.heading.trim()}</p>
          ) : null}
          <ul className={cn("space-y-0.5", g.heading?.trim() ? "mt-1.5" : "")}>
            {g.items.map((item) => (
              <li key={item.id}>
                <TocNavLink href={getHref(item.id)} onNavigate={onNavigate}>
                  {item.label}
                </TocNavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export type WorkspaceSectionTocProps = {
  groups: readonly WorkspaceTocGroup[];
  /** Return absolute in-app path (`/foo#bar`) or hash-only (`#bar`) for same-page anchors. */
  getHref: (sectionId: string) => string;
  desktopAriaLabel: string;
  /** Sheet / dialog accessible name. */
  mobileTitle?: string;
  /** Primary label on the mobile trigger button. */
  mobileTriggerLabel?: string;
};

export function WorkspaceSectionToc(props: WorkspaceSectionTocProps) {
  const {
    groups,
    getHref,
    desktopAriaLabel,
    mobileTitle = "Jump to section",
    mobileTriggerLabel = "Sections",
  } = props;

  const [expanded, setExpanded] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sheetId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const itemCount = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) setSheetOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  useEffect(() => {
    if (!sheetOpen) return;
    const root = sheetRef.current;
    const first = root?.querySelector<HTMLElement>("a[href], button:not([disabled])") ?? closeButtonRef.current ?? null;
    first?.focus({ preventScroll: true });
  }, [sheetOpen]);

  if (itemCount === 0) return null;

  return (
    <>
      <div className="lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn(
            "mb-6 w-full justify-between rounded-2xl border border-white/[0.1] bg-uls-surface/25 text-uls-text backdrop-blur-md shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)] hover:bg-white/[0.06]",
          )}
          aria-expanded={sheetOpen}
          aria-controls={sheetId}
          onClick={() => setSheetOpen(true)}
        >
          <span>{mobileTriggerLabel}</span>
          <span className="text-uls-subtle" aria-hidden>
            ↓
          </span>
        </Button>

        {sheetOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              aria-label="Dismiss section navigation"
              onClick={closeSheet}
            />
            <div
              ref={sheetRef}
              id={sheetId}
              role="dialog"
              aria-modal="true"
              aria-label={mobileTitle}
              className={cn(
                "workspace-toc-sheet-panel absolute bottom-0 left-0 right-0 z-10 mx-auto flex max-h-[min(88vh,28rem)] w-full max-w-none flex-col rounded-t-2xl border border-white/[0.12] bg-uls-surface/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-uls-text shadow-2xl outline-none backdrop-blur-xl supports-[backdrop-filter]:bg-uls-surface/80",
              )}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 pb-3 pt-3">
                <p className="text-sm font-semibold text-uls-text">{mobileTitle}</p>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="rounded-xl border border-transparent px-3 py-1.5 text-xs font-medium text-uls-muted hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-uls-text"
                  onClick={closeSheet}
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
                <nav className="px-1" aria-label={desktopAriaLabel}>
                  <TocGroupsContent groups={groups} getHref={getHref} onNavigate={closeSheet} />
                </nav>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 ease-out lg:block",
          expanded ? "w-[13.5rem]" : "w-[2.625rem]",
        )}
      >
        {!expanded ? (
          <aside className="sticky top-6 flex justify-center">
            <div className={cn(glassTocCard, "w-full p-3")}>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-lg text-uls-muted outline-none hover:bg-white/[0.06] hover:text-uls-text focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas lg:min-h-9 lg:min-w-9"
                title="Show section navigation"
                aria-label="Show section navigation"
              >
                »
              </button>
            </div>
          </aside>
        ) : (
          <aside className="sticky top-6 max-h-[min(92vh,calc(100vh-5rem))] overflow-y-auto">
            <div className={cn(glassTocCard, "p-3")}>
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-uls-subtle">Sections</span>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl px-2 text-xs text-uls-muted outline-none hover:bg-white/[0.06] hover:text-uls-text focus-visible:ring-2 focus-visible:ring-uls-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-uls-canvas lg:min-h-9 lg:min-w-9"
                  title="Hide navigation"
                  aria-label="Collapse section navigation"
                >
                  «
                </button>
              </div>
              <nav aria-label={desktopAriaLabel}>
                <TocGroupsContent groups={groups} getHref={getHref} />
              </nav>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
