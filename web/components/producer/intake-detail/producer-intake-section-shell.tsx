import type { ReactNode } from "react";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { cn } from "@/lib/cn";

export function ProducerIntakeSectionShell({
  id,
  title,
  description,
  children,
  sectionClassName,
  panelClassName,
  footer,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  sectionClassName?: string;
  panelClassName?: string;
  footer?: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6 mt-10 first:mt-0", sectionClassName)}>
      <ProducerGlassCard as="div" className={panelClassName}>
        <h2 className="text-sm font-semibold text-uls-text">{title}</h2>
        {description != null ? (
          <div className="mt-1 max-w-prose space-y-2 text-xs text-uls-muted [&_strong]:font-medium [&_strong]:text-uls-text [&_span.font-mono]:text-uls-subtle">
            {description}
          </div>
        ) : null}
        <div className="mt-4 space-y-4">{children}</div>
        {footer != null ? <div className="mt-6 border-t border-uls-border pt-4">{footer}</div> : null}
      </ProducerGlassCard>
    </section>
  );
}
