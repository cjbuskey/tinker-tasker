import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentOperation, CoachMessage as CoachMessageType } from '../types/coach';
import { CheckCircle, XCircle } from 'lucide-react';
import { normalizeCoachMessageContent } from '../services/coachService';

type Props = {
  message: CoachMessageType;
  isLast?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
};

function renderOperation(op: AgentOperation, idx: number) {
  if (op.type === 'update_status') {
    return <li key={idx}>Update {op.taskId} → {op.status}</li>;
  }
  if (op.type === 'reschedule') {
    return <li key={idx}>Move {op.taskId} → Week {op.newWeek}</li>;
  }
  if (op.type === 'delete_task') {
    return <li key={idx}>Remove task: {op.taskId}</li>;
  }
  const text = op.task?.text || 'New task';
  return <li key={idx}>Add task to Week {op.week}: {text}</li>;
}

export default function CoachMessage({ message, isLast, onConfirm, onReject }: Props) {
  const isUser = message.role === 'user';
  const isProposal = !isUser && message.weeklyPlan && (!message.operations || message.operations.length === 0);
  const displayContent = normalizeCoachMessageContent(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 shadow-sm border ${
          isUser ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
        {isUser ? (
          <div className="text-sm whitespace-pre-line leading-relaxed">{displayContent}</div>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm max-w-none
            prose-headings:text-slate-800 prose-headings:font-semibold prose-headings:mb-2
            prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-2
            prose-strong:text-slate-900 prose-strong:font-semibold
            prose-ul:list-disc prose-ul:ml-4 prose-ul:mb-2 prose-ul:space-y-1
            prose-ol:list-decimal prose-ol:ml-4 prose-ol:mb-2 prose-ol:space-y-1
            prose-li:text-slate-700 prose-li:text-sm prose-li:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent}
            </ReactMarkdown>
          </div>
        )}

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

        {isProposal && isLast && onConfirm && onReject && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={onConfirm}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Yes, do it
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              <XCircle className="w-3 h-3" />
              No, thanks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

