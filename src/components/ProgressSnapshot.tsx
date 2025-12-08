import React from 'react';

type Props = {
  currentWeek: number;
  totalWeeks: number;
  completedTasks: number;
  totalTasks: number;
  hoursPerWeekTarget?: number;
  weeklyPlanMinutes?: number;
};

export default function ProgressSnapshot({
  currentWeek,
  totalWeeks,
  completedTasks,
  totalTasks,
  hoursPerWeekTarget,
  weeklyPlanMinutes,
}: Props) {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-700">Week {currentWeek} of {totalWeeks}</div>
        {hoursPerWeekTarget ? (
          <div className="text-xs text-slate-500">~{hoursPerWeekTarget} hrs/week target</div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2"
            style={{ width: `${totalTasks ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0}%` }}
          />
        </div>
        <div className="text-xs text-slate-600">{completedTasks}/{totalTasks} tasks</div>
      </div>
      {weeklyPlanMinutes ? (
        <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
          This week: ~{weeklyPlanMinutes} minutes planned
        </div>
      ) : null}
    </div>
  );
}

