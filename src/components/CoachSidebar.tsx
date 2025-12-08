import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import CoachMessage from './CoachMessage';
import ProgressSnapshot from './ProgressSnapshot';
import { CoachMessage as CoachMessageType } from '../types/coach';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  messages: CoachMessageType[];
  onSend: (message: string) => Promise<void>;
  onClear: () => Promise<void> | void;
  sending: boolean;
  snapshot: {
    currentWeek: number;
    totalWeeks: number;
    completedTasks: number;
    totalTasks: number;
    hoursPerWeekTarget?: number;
    weeklyPlanMinutes?: number;
  };
};

const QUICK_TEMPLATES = [
  "I'm falling behind. I only finished part of last week and have ~3 hours this week.",
  "I'm ahead. I finished everything for this week—what should I pull in next?",
  "It's the start of the week. Plan my week with 3–5 tasks.",
];

export default function CoachSidebar({ isOpen, onClose, messages, onSend, onClear, sending, snapshot }: Props) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const toSend = input.trim();
    setInput('');
    await onSend(toSend);
  };

  const lastWeeklyPlanMinutes = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.weeklyPlan?.estimatedMinutes) return m.weeklyPlan.estimatedMinutes;
    }
    return snapshot.weeklyPlanMinutes;
  }, [messages, snapshot.weeklyPlanMinutes]);

  return (
    <div
      className={`fixed inset-y-0 right-0 w-full max-w-md bg-gradient-to-b from-slate-50 to-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 z-30 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } flex flex-col`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <div className="text-sm font-semibold text-slate-800">Plan Coach</div>
          <div className="text-xs text-slate-500">Ask for weekly plans, adjustments, or pivots.</div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pt-3 flex-shrink-0">
        <ProgressSnapshot {...snapshot} weeklyPlanMinutes={lastWeeklyPlanMinutes} />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onClear()}
            className="text-xs px-3 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            Clear chat
          </button>
        </div>
      </div>

      <div className="px-4 flex-shrink-0">
        <div className="flex gap-2 flex-wrap mb-4">
          {QUICK_TEMPLATES.map((t) => (
            <button
              key={t}
              onClick={() => setInput(t)}
              className="text-xs px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full hover:bg-indigo-100 transition"
            >
              {t.length > 46 ? `${t.slice(0, 46)}…` : t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-lg p-4">
            Start by telling the coach where you are and your time this week.
          </div>
        )}
        {messages.map((m, idx) => (
          <CoachMessage key={idx} message={m} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="bg-white border-t border-slate-200 p-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
            placeholder="Tell the coach how last week went and your hours this week..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

