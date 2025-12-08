import * as admin from 'firebase-admin';
import { anthropic } from './anthropic';

// Ensure admin is initialized even if this module is imported before index.ts runs
if (!admin.apps.length) {
  admin.initializeApp();
}

// Default to a widely available model; override via secret/env ANTHROPIC_MODEL
// Examples: claude-3-5-sonnet-20240620, claude-3-opus-20240229, claude-3-haiku-20240307
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

type AgentOperation =
  | { type: 'update_status'; taskId: string; status: 'todo' | 'in_progress' | 'done' | 'skipped' }
  | { type: 'reschedule'; taskId: string; newWeek: number }
  | { type: 'add_task'; week: number; task: { id?: string; text: string; estimatedMinutes?: number; category?: string } };

type WeeklyPlan = {
  week: number;
  tasks: string[];
  estimatedMinutes?: number;
};

type AgentResponse = {
  message: string;
  operations: AgentOperation[];
  weeklyPlan?: WeeklyPlan;
};

type CoachMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  operations?: AgentOperation[];
  weeklyPlan?: WeeklyPlan;
};

type UserProgress = {
  taskProgress?: Record<string, { status: string; userConfidence?: number; notes?: string }>;
  hoursPerWeekTarget?: number;
  focusAreas?: string[];
};

type Curriculum = {
  phases: Array<{
    id: string;
    title: string;
    weeks: Array<{
      id: number;
      title: string;
      goal: string;
      tasks: Array<{
        id: string;
        text: string;
        estimatedMinutes?: number;
        category?: string;
        importance?: number;
        skillLevel?: string;
      }>;
    }>;
  }>;
};

const db = admin.firestore();

async function fetchCurriculum(): Promise<Curriculum | null> {
  const snap = await db.doc('curriculum/main').get();
  if (!snap.exists) return null;
  const data = snap.data() as { phases: Curriculum['phases'] };
  return { phases: data.phases };
}

async function fetchUserProgress(userId: string): Promise<UserProgress> {
  const snap = await db.doc(`userProgress/${userId}`).get();
  if (!snap.exists) return {};
  return snap.data() as UserProgress;
}

async function fetchConversation(userId: string): Promise<CoachMessage[]> {
  const snap = await db.doc(`coachConversations/${userId}`).get();
  if (!snap.exists) return [];
  const data = snap.data() as { messages?: CoachMessage[] };
  return data.messages || [];
}

async function saveConversation(userId: string, messages: CoachMessage[]) {
  await db.doc(`coachConversations/${userId}`).set(
    {
      messages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function buildSystemPrompt(curriculum: Curriculum | null, progress: UserProgress) {
  const summary = {
    hoursPerWeekTarget: progress.hoursPerWeekTarget ?? 'unknown',
    focusAreas: progress.focusAreas ?? [],
    completed: Object.entries(progress.taskProgress || {})
      .filter(([, v]) => v.status === 'done')
      .map(([k]) => k),
    skipped: Object.entries(progress.taskProgress || {})
      .filter(([, v]) => v.status === 'skipped')
      .map(([k]) => k),
  };

  return [
    {
      role: 'system',
      content: `
You are a Plan Coach Agent that adjusts a 12-week curriculum.
You must reply with a JSON object containing: message, operations[], optional weeklyPlan.
Allowed operations:
- update_status { taskId, status: todo|in_progress|done|skipped }
- reschedule { taskId, newWeek }
- add_task { week, task { text, estimatedMinutes?, category? } }
Weekly plan shape: { week, tasks: string[], estimatedMinutes? }.
Be concise and actionable.`,
    },
    {
      role: 'system',
      content: `Curriculum summary: ${JSON.stringify(curriculum ?? { phases: [] }).slice(0, 12000)}`,
    },
    {
      role: 'system',
      content: `User progress summary: ${JSON.stringify(summary).slice(0, 4000)}`,
    },
  ];
}

function trimHistory(history: CoachMessage[]): CoachMessage[] {
  const sorted = [...history].sort((a, b) => a.createdAt - b.createdAt);
  const last = sorted.slice(-8);
  return last;
}

export async function runCoachAgent(userId: string, userMessage: string): Promise<AgentResponse> {
  const [curriculum, progress, history] = await Promise.all([
    fetchCurriculum(),
    fetchUserProgress(userId),
    fetchConversation(userId),
  ]);

  const prompt = buildSystemPrompt(curriculum, progress);
  const convo = trimHistory(history);

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 800,
    temperature: 0.3,
    system: prompt.map((p) => p.content).join('\n\n'),
    messages: [
      ...convo.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ],
  });

  const content = response.content[0];
  let parsed: AgentResponse = { message: 'No response', operations: [] };

  if (content.type === 'text') {
    try {
      parsed = JSON.parse(content.text) as AgentResponse;
    } catch (err) {
      parsed = {
        message: content.text || 'Coach could not parse a response.',
        operations: [],
      };
    }
  }

  const assistantMessage: CoachMessage = {
    role: 'assistant',
    content: parsed.message,
    operations: parsed.operations,
    weeklyPlan: parsed.weeklyPlan,
    createdAt: Date.now(),
  };

  const newHistory: CoachMessage[] = [...history, { role: 'user', content: userMessage, createdAt: Date.now() }, assistantMessage];
  await saveConversation(userId, trimHistory(newHistory));

  return parsed;
}

