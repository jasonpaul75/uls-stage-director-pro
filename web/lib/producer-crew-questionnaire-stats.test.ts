import { describe, expect, it } from "vitest";

import {
  producerCrewQuestionnaireRollup,
  producerIntakeQuestionnaireRowGapProjectCount,
  producerCrewQuestionnaireMissingAndDraftCounts,
} from "./producer-crew-questionnaire-stats";

describe("producerCrewQuestionnaireRollup", () => {
  it("counts submitted vs draft and assignments missing rows", () => {
    const r = producerCrewQuestionnaireRollup({
      assignmentStaffIds: ["a", "b", "c"],
      questionnaires: [
        { staffUserId: "a", submittedAt: new Date("2026-01-01") },
        { staffUserId: "b", submittedAt: null },
      ],
    });
    expect(r.questionnaireSubmitted).toBe(1);
    expect(r.questionnaireDraft).toBe(1);
    expect(r.crewMissingQuestionnaireRow).toBe(1);
  });

  it("treats empty assignments as zero missing even when questionnaires exist", () => {
    const r = producerCrewQuestionnaireRollup({
      assignmentStaffIds: [],
      questionnaires: [{ staffUserId: "x", submittedAt: null }],
    });
    expect(r.crewMissingQuestionnaireRow).toBe(0);
    expect(r.questionnaireDraft).toBe(1);
  });

  it("counts all assignments missing when no questionnaires", () => {
    const r = producerCrewQuestionnaireRollup({
      assignmentStaffIds: ["u", "v"],
      questionnaires: [],
    });
    expect(r.crewMissingQuestionnaireRow).toBe(2);
    expect(r.questionnaireSubmitted).toBe(0);
    expect(r.questionnaireDraft).toBe(0);
  });
});

describe("producerCrewQuestionnaireMissingAndDraftCounts", () => {
  it("derives missing rows and drafts from aggregate counts", () => {
    expect(
      producerCrewQuestionnaireMissingAndDraftCounts({
        assignmentCount: 5,
        questionnaireRowCount: 3,
        questionnaireSubmittedCount: 2,
      }),
    ).toEqual({ missingQuestionnaireRows: 2, draftQuestionnaireRows: 1 });
  });

  it("floors both at zero when rows exceed assignments", () => {
    expect(
      producerCrewQuestionnaireMissingAndDraftCounts({
        assignmentCount: 2,
        questionnaireRowCount: 4,
        questionnaireSubmittedCount: 4,
      }),
    ).toEqual({ missingQuestionnaireRows: 0, draftQuestionnaireRows: 0 });
  });

  it("zeros both when no assignments even if orphaned questionnaire rows exist", () => {
    expect(
      producerCrewQuestionnaireMissingAndDraftCounts({
        assignmentCount: 0,
        questionnaireRowCount: 3,
        questionnaireSubmittedCount: 0,
      }),
    ).toEqual({ missingQuestionnaireRows: 0, draftQuestionnaireRows: 0 });
  });
});

describe("producerIntakeQuestionnaireRowGapProjectCount", () => {
  it("counts projects whose questionnaire rows are fewer than assignments", () => {
    expect(
      producerIntakeQuestionnaireRowGapProjectCount([
        { assignmentCount: 3, questionnaireRowCount: 2 },
        { assignmentCount: 2, questionnaireRowCount: 2 },
        { assignmentCount: 1, questionnaireRowCount: 0 },
      ]),
    ).toBe(2);
  });

  it("is zero when rows meet or exceed assignments", () => {
    expect(
      producerIntakeQuestionnaireRowGapProjectCount([
        { assignmentCount: 2, questionnaireRowCount: 3 },
        { assignmentCount: 1, questionnaireRowCount: 1 },
      ]),
    ).toBe(0);
  });

  it("is zero for an empty list", () => {
    expect(producerIntakeQuestionnaireRowGapProjectCount([])).toBe(0);
  });
});
