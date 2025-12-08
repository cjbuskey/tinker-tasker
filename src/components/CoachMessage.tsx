import React from 'react';
import { AgentOperation, CoachMessage as CoachMessageType } from '../types/coach';

type Props = {
  message: CoachMessageType;
};

function renderOperation(op: AgentOperation, idx: number) {
  if (op.type === 'update_status') {
    return <li key={idx}>Update {op.taskId} → {op.status}</li>;
  }
  if (op.type === 'reschedule') {
    return <li key={idx}>Move {op.taskId} → Week {op.newWeek}</li>;
  }
  const text = op.task?.text || 'New task';
  return <li key={idx}>Add task to Week {op.week}: {text}</li>;
}

export default function CoachMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 shadow-sm border ${
          isUser ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
        <div className="text-sm whitespace-pre-line leading-relaxed">{message.content}</div>

        {message.weeklyPlan && message.weeklyPlan.tasks && (
          <div className="mt-3 text-xs bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-lg p-3">
            <div className="font-semibold mb-1">Weekly plan (Week {message.weeklyPlan.week})</div>
            <ul className="list-disc ml-4 space-y-0.5">
              {(message.weeklyPlan.tasks || []).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {message.weeklyPlan.estimatedMinutes ? (
              <div className="mt-1 text-indigo-700">~{message.weeklyPlan.estimatedMinutes} minutes</div>
            ) : null}
          </div>
        )}

        {message.operations && message.operations.length > 0 && (
          <div className="mt-3 text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-lg p-3">
            <div className="font-semibold mb-1">Planned changes</div>
            <ul className="list-disc ml-4 space-y-0.5">
              {message.operations.map(renderOperation)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

