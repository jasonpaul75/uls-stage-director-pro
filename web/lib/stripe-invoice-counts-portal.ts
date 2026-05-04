import { prisma } from "@/lib/prisma";

/** Per-project Stripe invoice counts keyed by synced `status` string. */

export type PortalStripeBuckets = {
  draft: number;
  open: number;
  paid: number;
  void: number;
  uncollectible: number;
  other: number;
  total: number;
};

/** Empty buckets when ids array is empty. */

export async function stripeInvoiceBucketsByProject(ids: string[]): Promise<Map<string, PortalStripeBuckets>> {
  const map = new Map<string, PortalStripeBuckets>();

  if (ids.length === 0) return map;

  for (const id of ids) {
    map.set(id, { draft: 0, open: 0, paid: 0, void: 0, uncollectible: 0, other: 0, total: 0 });
  }

  const grouped = await prisma.projectStripeInvoice.groupBy({
    by: ["projectId", "status"],
    where: { projectId: { in: ids } },
    _count: { _all: true },
  });

  for (const row of grouped) {
    const b = map.get(row.projectId);
    if (!b) continue;

    const n = row._count._all;
    b.total += n;

    switch (row.status) {
      case "draft":
        b.draft += n;
        break;
      case "open":
        b.open += n;
        break;
      case "paid":
        b.paid += n;
        break;
      case "void":
        b.void += n;
        break;
      case "uncollectible":
        b.uncollectible += n;
        break;
      default:
        b.other += n;
        break;
    }
  }

  return map;
}
