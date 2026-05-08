/** Items for screen-reader breadcrumbs — omit `href` on the current page crumb. */

export type WorkspaceBreadcrumbItem = { label: string; href?: string };

export function normalizePathnameSegments(pathname: string): string[] {
  const p = pathname.trim().replace(/\/$/, "") || "/";
  if (p === "/") return [];
  return p.split("/").filter(Boolean);
}

/** UUID / hyphenated ids / Stripe-style CUID-ish tokens in URLs */
function segmentLooksLikeTechnicalId(seg: string): boolean {
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(seg)) return true;
  if (/^[a-f0-9-]{12,}$/i.test(seg)) return true;
  if (/^c[a-z0-9]{8,}$/i.test(seg)) return true;
  return seg.length >= 18 && /^[a-zA-Z0-9_-]+$/.test(seg);
}

const producerSegmentLabels: Record<string, string> = {
  producer: "Production",
  inbox: "Inbox",
  "media-library": "Media library",
  support: "Support",
  admin: "Admin",
  users: "Staff accounts",
  export: "Export CSV",
  event: "Event workspace",
};

/** Production workspace (`/producer/...`) breadcrumbs for SR-only landmark. */
export function producerBreadcrumbItems(pathname: string): WorkspaceBreadcrumbItem[] {
  const parts = normalizePathnameSegments(pathname);
  if (parts.length === 0 || parts[0] !== "producer") return [];

  function segmentLabel(i: number): string {
    const seg = parts[i];
    const known = producerSegmentLabels[seg];
    if (known) return known;
    const prev = parts[i - 1];
    const next = parts[i + 1];
    if (segmentLooksLikeTechnicalId(seg)) {
      if (prev === "inbox") {
        if (next === "event") return "Project";
        if (i === parts.length - 1) return "Intake detail";
      }
      if (prev === "support" && i === parts.length - 1) return "Support ticket";
    }
    if (seg.length <= 48) return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    return "Page";
  }

  const out: WorkspaceBreadcrumbItem[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cumulative = "/" + parts.slice(0, i + 1).join("/");
    const last = i === parts.length - 1;
    out.push({
      label: segmentLabel(i),
      href: last ? undefined : cumulative,
    });
  }
  return out;
}

const portalRoot: WorkspaceBreadcrumbItem = { label: "Director portal", href: "/portal" };

/** Director portal (`/portal/...`) breadcrumbs for SR-only landmark. */
export function portalBreadcrumbItems(pathname: string): WorkspaceBreadcrumbItem[] {
  const parts = normalizePathnameSegments(pathname);
  if (parts.length === 0 || parts[0] !== "portal") return [];

  if (parts.length === 1) {
    return [{ label: "Director portal", href: undefined }];
  }

  if (parts[1] === "intake" && parts[2] === "new") {
    return [portalRoot, { label: "New intake", href: undefined }];
  }

  const projectsIdx = parts.indexOf("projects");
  const showsIdx = parts.indexOf("shows");

  if (
    projectsIdx !== -1 &&
    parts[projectsIdx + 1] &&
    segmentLooksLikeTechnicalId(parts[projectsIdx + 1])
  ) {
    const pid = parts[projectsIdx + 1];
    const projectHref = `/portal/projects/${pid}`;
    if (projectsIdx + 2 === parts.length) {
      return [portalRoot, { label: "Intake workspace", href: undefined }];
    }
    if (parts[projectsIdx + 2] === "support") {
      if (
        parts.length === projectsIdx + 4 &&
        parts[projectsIdx + 3] &&
        segmentLooksLikeTechnicalId(parts[projectsIdx + 3])
      ) {
        return [
          portalRoot,
          { label: "Intake workspace", href: projectHref },
          { label: "Support ticket", href: undefined },
        ];
      }
      return [portalRoot, { label: "Intake workspace", href: projectHref }, { label: "Support", href: undefined }];
    }
  }

  if (showsIdx !== -1 && parts[showsIdx + 1] && segmentLooksLikeTechnicalId(parts[showsIdx + 1])) {
    void parts[showsIdx + 1];
    return [portalRoot, { label: "Show workspace", href: undefined }];
  }

  const fallbackLabel: Record<string, string> = {
    portal: "Director portal",
    intake: "Intake",
    new: "New intake",
    projects: "Project",
    shows: "Shows",
    support: "Support",
  };

  function genericLabel(seg: string): string {
    return fallbackLabel[seg] ?? (seg.length <= 48 ? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ") : "Page");
  }

  const out: WorkspaceBreadcrumbItem[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cumulative = "/" + parts.slice(0, i + 1).join("/");
    const last = i === parts.length - 1;
    out.push({
      label: genericLabel(parts[i]),
      href: last ? undefined : cumulative,
    });
  }
  return out;
}
