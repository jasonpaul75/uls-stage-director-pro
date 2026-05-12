export type ProducerCrewQuestionnaireRollupRow = {
  staffUserId: string;
  submittedAt: Date | null;
};

/**
 * Producer Crew page roll-up for travel/meals/payment questionnaire rows vs assignments.
 */
export function producerCrewQuestionnaireRollup(input: {
  assignmentStaffIds: readonly string[];
  questionnaires: readonly ProducerCrewQuestionnaireRollupRow[];
}): {
  crewMissingQuestionnaireRow: number;
  questionnaireSubmitted: number;
  questionnaireDraft: number;
} {
  const questionnaireStaffIds = new Set(input.questionnaires.map((q) => q.staffUserId));
  const crewMissingQuestionnaireRow = input.assignmentStaffIds.filter((id) => !questionnaireStaffIds.has(id)).length;
  const questionnaireSubmitted = input.questionnaires.filter((q) => q.submittedAt != null).length;
  const questionnaireDraft = input.questionnaires.filter((q) => q.submittedAt == null).length;
  return { crewMissingQuestionnaireRow, questionnaireSubmitted, questionnaireDraft };
}

/** Aligns inbox / calendar / intake detail triage: rows not yet created vs crew, and drafts among existing rows. */
export function producerCrewQuestionnaireMissingAndDraftCounts(input: {
  assignmentCount: number;
  questionnaireRowCount: number;
  questionnaireSubmittedCount: number;
}): { missingQuestionnaireRows: number; draftQuestionnaireRows: number } {
  if (input.assignmentCount <= 0) {
    return { missingQuestionnaireRows: 0, draftQuestionnaireRows: 0 };
  }
  const missingQuestionnaireRows = Math.max(0, input.assignmentCount - input.questionnaireRowCount);
  const draftQuestionnaireRows = Math.max(0, input.questionnaireRowCount - input.questionnaireSubmittedCount);
  return { missingQuestionnaireRows, draftQuestionnaireRows };
}

/** Command-center-style count: productions where questionnaire rows lag assigned crew (`rows < assignments`). */
export function producerIntakeQuestionnaireRowGapProjectCount(
  projects: readonly { assignmentCount: number; questionnaireRowCount: number }[],
): number {
  return projects.reduce((n, p) => n + (p.questionnaireRowCount < p.assignmentCount ? 1 : 0), 0);
}
