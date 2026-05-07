import { revalidatePath } from "next/cache";

/**
 * Command center (`/producer`) + intake list (`/producer/inbox`) — counts, assignees, webhook pulse, etc.
 * Pair with {@link revalidateProjectMirrorCache} when a project-scoped mirror row also changed.
 */
export function revalidateProducerOverview() {
  revalidatePath("/producer");
  revalidatePath("/producer/inbox");
}

/**
 * Portal support UI for a project + producer support queue (not individual ticket detail pages).
 */
export function revalidateSupportQueues(projectId: string) {
  revalidatePath(`/portal/projects/${projectId}/support`);
  revalidatePath("/producer/support");
}

/** Producer ticket thread only; queue/list pages use {@link revalidateSupportQueues}. */
export function revalidateProducerSupportTicketDetail(ticketId: string) {
  revalidatePath(`/producer/support/${ticketId}`);
}

/**
 * Invalidate cached pages that show this project’s mirrored director/producer state (billing, contracts,
 * proposal toggles, booking, RoS, support, etc.) plus `/portal` (list + attention banners).
 * Often called together with {@link revalidateProducerOverview} when producer-global summaries may change.
 */
export function revalidateProjectMirrorCache(projectId: string) {
  revalidatePath(`/portal/projects/${projectId}`);
  revalidatePath(`/portal/shows/${projectId}`);
  revalidatePath(`/producer/inbox/${projectId}`);
  revalidatePath(`/producer/inbox/${projectId}/event`);
  revalidatePath("/portal");
}
