export type WeekLike = {
  id: number;
  tasks: { id: string }[];
};

export type PhaseLike = {
  weeks: WeekLike[];
};

export function getCurrentWeek(phases: PhaseLike[], completed: Set<string>): number {
  for (const phase of phases) {
    for (const week of phase.weeks) {
      const allDone = week.tasks.every((t) => completed.has(t.id));
      if (!allDone) return week.id;
    }
  }
  const last = phases.flatMap((p) => p.weeks).pop();
  return last ? last.id : 1;
}

