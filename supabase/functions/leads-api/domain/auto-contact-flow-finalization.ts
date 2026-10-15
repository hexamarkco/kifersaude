export type AutoContactFlowFinalizationConfig = {
  finalStatus?: string | null;
  steps: readonly unknown[];
};

export function resolveAutoContactFlowFinalStatus(
  flow: AutoContactFlowFinalizationConfig,
  completedStepOrder: number,
): string | null {
  if (completedStepOrder !== flow.steps.length - 1) return null;

  const finalStatus = flow.finalStatus?.trim();
  return finalStatus || null;
}
