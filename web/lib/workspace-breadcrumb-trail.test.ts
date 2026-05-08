import { describe, expect, it } from "vitest";

import {
  normalizePathnameSegments,
  portalBreadcrumbItems,
  producerBreadcrumbItems,
} from "./workspace-breadcrumb-trail";

describe("normalizePathnameSegments", () => {
  it("trims slashes", () => {
    expect(normalizePathnameSegments("/producer/inbox")).toEqual(["producer", "inbox"]);
    expect(normalizePathnameSegments("/producer/inbox/")).toEqual(["producer", "inbox"]);
    expect(normalizePathnameSegments("/")).toEqual([]);
  });
});

describe("producerBreadcrumbItems", () => {
  it("covers Production home", () => {
    expect(producerBreadcrumbItems("/producer")).toEqual([
      { label: "Production", href: undefined },
    ]);
  });

  it("covers inbox and intake detail", () => {
    expect(producerBreadcrumbItems("/producer/inbox")).toEqual([
      { label: "Production", href: "/producer" },
      { label: "Inbox", href: undefined },
    ]);
    expect(producerBreadcrumbItems("/producer/inbox/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toEqual([
      { label: "Production", href: "/producer" },
      { label: "Inbox", href: "/producer/inbox" },
      { label: "Intake detail", href: undefined },
    ]);
  });

  it("covers event workspace", () => {
    const pid = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(producerBreadcrumbItems(`/producer/inbox/${pid}/event`)).toEqual([
      { label: "Production", href: "/producer" },
      { label: "Inbox", href: "/producer/inbox" },
      { label: "Project", href: `/producer/inbox/${pid}` },
      { label: "Event workspace", href: undefined },
    ]);
  });

  it("covers support ticket", () => {
    expect(producerBreadcrumbItems("/producer/support/ticket-placeholder-aaaaaaaa")).toEqual([
      { label: "Production", href: "/producer" },
      { label: "Support", href: "/producer/support" },
      { label: "Support ticket", href: undefined },
    ]);
  });
});

describe("portalBreadcrumbItems", () => {
  it("covers portal home", () => {
    expect(portalBreadcrumbItems("/portal")).toEqual([
      { label: "Director portal", href: undefined },
    ]);
  });

  it("covers new intake", () => {
    expect(portalBreadcrumbItems("/portal/intake/new")).toEqual([
      { label: "Director portal", href: "/portal" },
      { label: "New intake", href: undefined },
    ]);
  });

  it("covers intake workspace", () => {
    expect(portalBreadcrumbItems("/portal/projects/proj-aaaaaaaaaaaaaaaaaaa")).toEqual([
      { label: "Director portal", href: "/portal" },
      { label: "Intake workspace", href: undefined },
    ]);
  });

  it("covers show workspace", () => {
    expect(portalBreadcrumbItems("/portal/shows/proj-aaaaaaaaaaaaaaaaaaa")).toEqual([
      { label: "Director portal", href: "/portal" },
      { label: "Show workspace", href: undefined },
    ]);
  });

  it("covers project support and ticket detail", () => {
    expect(portalBreadcrumbItems("/portal/projects/proj-aaaaaaaaaaaaaaaaaaa/support")).toEqual([
      { label: "Director portal", href: "/portal" },
      {
        label: "Intake workspace",
        href: "/portal/projects/proj-aaaaaaaaaaaaaaaaaaa",
      },
      { label: "Support", href: undefined },
    ]);
    expect(
      portalBreadcrumbItems(
        "/portal/projects/proj-aaaaaaaaaaaaaaaaaaa/support/f47ac10b-58cc-4372-a567-0e02b2c3d479",
      ),
    ).toEqual([
      { label: "Director portal", href: "/portal" },
      {
        label: "Intake workspace",
        href: "/portal/projects/proj-aaaaaaaaaaaaaaaaaaa",
      },
      { label: "Support ticket", href: undefined },
    ]);
  });
});
