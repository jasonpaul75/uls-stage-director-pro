/** Whether portal show renders the Stage diagram nav anchor + workspace section (`PortalShowWorkspaceSections`). */
export function portalStageDiagramSectionVisible(
  project: {
    stageDesign?: unknown | null;
    stageDesignDirectorVisible?: boolean | null;
  },
  isAdmin: boolean,
): boolean {
  return Boolean(project.stageDesign) && ((project.stageDesignDirectorVisible ?? false) || isAdmin);
}
