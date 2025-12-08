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

function cleanMessage(message: CoachMessage): CoachMessage {
  const cleaned: any = { ...message };
  if (cleaned.weeklyPlan === undefined) delete cleaned.weeklyPlan;
  if (cleaned.operations === undefined) delete cleaned.operations;
  // Guard against undefined inside weeklyPlan (e.g., estimatedMinutes)
  if (cleaned.weeklyPlan) {
    if (cleaned.weeklyPlan.estimatedMinutes === undefined) {
      delete cleaned.weeklyPlan.estimatedMinutes;
    }
  }
  return cleaned;
}

async function saveConversation(userId: string, messages: CoachMessage[]) {
  const cleanedMessages = messages.map(cleanMessage);
  await db.doc(`coachConversations/${userId}`).set(
    {
      messages: cleanedMessages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function buildSystemPrompt(curriculum: Curriculum | null, progress: UserProgress) {
  const summary = {
    hoursPerWeekTarget: progress.hoursPerWeekTarget ?? 'unknown',
    focusAreas: progress.focusAreas ?? [],
    // include full status map for context
    statuses: progress.taskProgress ?? {},
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
You are a Plan Coach Agent that helps users with a 12-week AI agent curriculum.

RESPONSE FORMAT (required JSON):
{
  "message": "Human-readable summary with specific task details",
  "operations": [/* array of operations */],
  "weeklyPlan": { "week": number, "tasks": ["Full task text..."], "estimatedMinutes": number }
}

ALLOWED OPERATIONS:
- update_status: { "type": "update_status", "taskId": "w1t1", "status": "todo|in_progress|done|skipped" }
- reschedule: { "type": "reschedule", "taskId": "w1t1", "newWeek": 2 }
- add_task: { "type": "add_task", "week": 1, "task": { "text": "Full task description", "estimatedMinutes": 60, "category": "mcp" } }

IMPORTANT:
- In "message", explain WHAT tasks you're recommending with full task names/descriptions
- In "weeklyPlan.tasks", use FULL task text from curriculum, NOT just task IDs
- Be specific: reference actual task names like "Set up MCP dev environment" not "w1t1"
- Check user's current progress (statuses) before suggesting changes
- Don't repeat previous suggestions; build on the conversation history`,
    },
    {
      role: 'system',
      content: `Full curriculum (tasks with IDs and text): ${JSON.stringify(curriculum ?? { phases: [] }).slice(0, 14000)}`,
    },
    {
      role: 'system',
      content: `User progress (task statuses, confidence, notes): ${JSON.stringify(summary).slice(0, 5000)}`,
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
    max_tokens: 1500,
    temperature: 0.2,
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
      // Try to salvage JSON embedded in text
      const maybeJson = content.text?.match(/\{[\s\S]*\}/);
      if (maybeJson) {
        try {
          parsed = JSON.parse(maybeJson[0]) as AgentResponse;
        } catch {
          parsed = {
            message: content.text || 'Coach could not parse a response.',
            operations: [],
          };
        }
      } else {
        parsed = {
          message: content.text || 'Coach could not parse a response.',
          operations: [],
        };
      }
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

  // Normalize operations to ensure downstream expects "type"
  const normalizedOps: AgentOperation[] = (parsed.operations || []).map((op: any) => {
    if (op.type) return op as AgentOperation;
    if (op.operation === 'add_task') {
      return { type: 'add_task', week: op.week, task: op.task };
    }
    if (op.operation === 'update_status') {
      return { type: 'update_status', taskId: op.taskId, status: op.status };
    }
    if (op.operation === 'reschedule') {
      return { type: 'reschedule', taskId: op.taskId, newWeek: op.newWeek };
    }
    return op as AgentOperation;
  });

  return { ...parsed, operations: normalizedOps };
}

