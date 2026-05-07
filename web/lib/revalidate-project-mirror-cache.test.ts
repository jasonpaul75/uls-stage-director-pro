import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

describe("revalidateProjectMirrorCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates portal project, show, producer detail, event workspace, and portal home", async () => {
    const { revalidateProjectMirrorCache } = await import("./revalidate-project-mirror-cache");
    revalidateProjectMirrorCache("proj_xyz");

    expect(revalidatePath).toHaveBeenCalledWith("/portal/projects/proj_xyz");
    expect(revalidatePath).toHaveBeenCalledWith("/portal/shows/proj_xyz");
    expect(revalidatePath).toHaveBeenCalledWith("/producer/inbox/proj_xyz");
    expect(revalidatePath).toHaveBeenCalledWith("/producer/inbox/proj_xyz/event");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
    expect(revalidatePath).toHaveBeenCalledTimes(5);
  });
});

describe("revalidateProducerOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates command center and intake list", async () => {
    const { revalidateProducerOverview } = await import("./revalidate-project-mirror-cache");
    revalidateProducerOverview();
    expect(revalidatePath).toHaveBeenCalledWith("/producer");
    expect(revalidatePath).toHaveBeenCalledWith("/producer/inbox");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});

describe("revalidateSupportQueues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates portal support and producer queue", async () => {
    const { revalidateSupportQueues } = await import("./revalidate-project-mirror-cache");
    revalidateSupportQueues("proj_abc");
    expect(revalidatePath).toHaveBeenCalledWith("/portal/projects/proj_abc/support");
    expect(revalidatePath).toHaveBeenCalledWith("/producer/support");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});

describe("revalidateProducerSupportTicketDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates producer ticket thread", async () => {
    const { revalidateProducerSupportTicketDetail } = await import("./revalidate-project-mirror-cache");
    revalidateProducerSupportTicketDetail("ticket_1");
    expect(revalidatePath).toHaveBeenCalledWith("/producer/support/ticket_1");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });
});
