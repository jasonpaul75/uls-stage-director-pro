import Link from "next/link";

import { ProjectStatus } from "@prisma/client";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { buttonClassName } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { formatMoneyFromCents } from "@/lib/stripe-invoice-ui";

/** Lists Stripe invoice rows stuck in **open** / **draft** for queued intakes — Command center drill-down (#8). */
export async function ProducerCommandCenterOpenInvoices() {
  const intakeWhere = { status: ProjectStatus.INTAKE_SUBMITTED };
  const rows = await prisma.projectStripeInvoice.findMany({
    where: {
      status: { in: ["open", "draft"] },
      project: intakeWhere,
    },
    orderBy: { updatedAt: "desc" },
    take: 48,
    select: {
      id: true,
      status: true,
      hostedInvoiceUrl: true,
      invoiceNumber: true,
      amountDueCents: true,
      currency: true,
      stripeInvoiceId: true,
      project: { select: { id: true, name: true } },
    },
  });

  return (
    <ProducerGlassCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-uls-text">Open / draft invoices</p>
          <p className="mt-1 text-[11px] leading-relaxed text-uls-muted">
            Stripe-hosted settlement links when available — scoped to queued intake productions only.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-uls-muted">No open or draft invoices on queued intakes.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/15">
          <table className="w-full min-w-[640px] border-collapse text-left text-[11px] text-uls-muted">
            <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">
              <tr>
                <th className="px-3 py-2 font-semibold">Production</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Invoice #</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Stripe id</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dueLabel =
                  typeof row.amountDueCents === "number"
                    ? formatMoneyFromCents(row.amountDueCents, row.currency)
                    : "—";
                return (
                  <tr key={row.id} className="border-b border-white/[0.04] last:border-b-0">
                    <td className="px-3 py-2 font-medium text-uls-text">{row.project.name}</td>
                    <td className="px-3 py-2 capitalize">{row.status}</td>
                    <td className="px-3 py-2">{row.invoiceNumber ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{dueLabel}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-[10px] text-uls-subtle">
                      {row.stripeInvoiceId}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.hostedInvoiceUrl ? (
                          <a
                            href={row.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClassName("primary", "sm")}
                          >
                            Open invoice
                          </a>
                        ) : (
                          <span className="text-uls-subtle" title="Hosted URL sync may lag webhook enrichment">
                            No hosted link yet
                          </span>
                        )}
                        <Link
                          href={`/producer/inbox/${row.project.id}`}
                          className={buttonClassName("secondary", "sm")}
                        >
                          Intake detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ProducerGlassCard>
  );
}
