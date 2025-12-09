import { httpsCallable, getFunctions } from 'firebase/functions';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import app, { db } from '../firebase';
import { AgentOperation, AgentResponse, CoachMessage } from '../types/coach';

function parseJsonIfPresent(value: string): Partial<AgentResponse> | null {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Partial<AgentResponse>;
  } catch {
    return null;
  }
}

function extractMessageFromPseudoJson(value: string): string | null {
  // Try to capture the message field even if the JSON isn't strictly valid (e.g., unescaped newlines)
  const msgMatch = value.match(/"message"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/);
  if (msgMatch && msgMatch[1]) {
    return msgMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .trim();
  }
  return null;
}

// Extract a human-readable message from raw/JSON-ish content
export function normalizeCoachMessageContent(content: string): string {
  if (!content) return '';
  const parsed = parseJsonIfPresent(content);
  if (parsed && typeof parsed.message === 'string') {
    return parsed.message;
  }
   const pseudo = extractMessageFromPseudoJson(content);
   if (pseudo) return pseudo;
  return content;
}

function normalizeAgentResponse(raw: AgentResponse | string | undefined | null): AgentResponse {
  if (!raw) {
    return { message: 'No response', operations: [] };
  }

  // Handle the whole payload being a JSON string
  if (typeof raw === 'string') {
    const parsed = parseJsonIfPresent(raw);
    if (parsed) {
      return {
        message: typeof parsed.message === 'string' ? parsed.message : 'No response',
        operations: parsed.operations || [],
        weeklyPlan: parsed.weeklyPlan,
      };
    }
    return { message: raw, operations: [] };
  }

  // Handle the message itself containing JSON
  const parsedMessage = typeof raw.message === 'string' ? parseJsonIfPresent(raw.message) : null;

  return {
    message: parsedMessage?.message && typeof parsedMessage.message === 'string'
      ? parsedMessage.message
      : typeof raw.message === 'string'
        ? normalizeCoachMessageContent(raw.message)
        : raw.message,
    operations: parsedMessage?.operations || raw.operations || [],
    weeklyPlan: parsedMessage?.weeklyPlan || raw.weeklyPlan,
  };
}

export function normalizeCoachMessage(message: CoachMessage): CoachMessage {
  return {
    ...message,
    content: normalizeCoachMessageContent(message.content),
  };
}

export async function sendCoachMessage(message: string): Promise<AgentResponse> {
  const functions = getFunctions(app);
  const callable = httpsCallable<{ message: string }, AgentResponse>(functions, 'coachAgent');
  const res = await callable({ message });
  return normalizeAgentResponse(res.data);
}

export async function loadConversation(userId = 'default'): Promise<CoachMessage[]> {
  const ref = doc(db, 'coachConversations', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as { messages?: CoachMessage[] };
  return (data.messages || []).map(normalizeCoachMessage);
}

export async function clearConversation(userId = 'default'): Promise<void> {
  await deleteDoc(doc(db, 'coachConversations', userId));
}

type Curriculum = {
  phases: Array<{
    id: string;
    title: string;
    weeks: Array<{
      id: number;
      title: string;
      goal: string;
      resources?: { name: string; url: string }[];
      tasks: Array<{
        id: string;
        text: string;
        time: string;
        estimatedMinutes?: number;
        category?: string;
        skillLevel?: string;
        importance?: number;
        prerequisites?: string[];
        subtasks?: string[];
      }>;
    }>;
  }>;
};

type TaskProgress = Record<string, { status: 'todo' | 'in_progress' | 'done' | 'skipped'; userConfidence?: number; notes?: string }>;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function applyOperationsLocally(
  operations: AgentOperation[],
  curriculum: Curriculum,
  taskProgress: TaskProgress,
): { curriculum: Curriculum; taskProgress: TaskProgress } {
  const normalizedOps: AgentOperation[] = operations.map((op: any) => {
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

  let updatedCurriculum = deepClone(curriculum);
  const updatedProgress: TaskProgress = { ...taskProgress };

  for (const op of normalizedOps) {
    if (op.type === 'update_status') {
      updatedProgress[op.taskId] = { ...(updatedProgress[op.taskId] || {}), status: op.status };
    }

    if (op.type === 'reschedule') {
      updatedCurriculum = rescheduleTask(updatedCurriculum, op.taskId, op.newWeek);
    }

    if (op.type === 'add_task') {
      updatedCurriculum = addTaskToWeek(updatedCurriculum, op.week, op.task);
    }

    if (op.type === 'delete_task') {
      updatedCurriculum = deleteTaskById(updatedCurriculum, op.taskId);
    }
  }

  return { curriculum: updatedCurriculum, taskProgress: updatedProgress };
}

function rescheduleTask(curriculum: Curriculum, taskId: string, newWeek: number): Curriculum {
  const clone = deepClone(curriculum);
  let movedTask: any = null;

  for (const phase of clone.phases) {
    for (const week of phase.weeks) {
      const idx = week.tasks.findIndex((t) => t.id === taskId);
      if (idx >= 0) {
        movedTask = week.tasks.splice(idx, 1)[0];
        break;
      }
    }
  }

  if (!movedTask) return clone;

  for (const phase of clone.phases) {
    const target = phase.weeks.find((w) => w.id === newWeek);
    if (target) {
      target.tasks.push(movedTask);
      return clone;
    }
  }

  return clone;
}

// Counter to ensure unique IDs even when adding multiple tasks in same millisecond
let taskIdCounter = 0;

function addTaskToWeek(
  curriculum: Curriculum,
  week: number,
  task: { id?: string; text: string; estimatedMinutes?: number; category?: string },
): Curriculum {
  const clone = deepClone(curriculum);
  // Use counter + random to ensure unique IDs
  const taskId = task.id || `auto-${Date.now()}-${taskIdCounter++}-${Math.random().toString(36).slice(2, 6)}`;

  console.log(`Adding task to week ${week}:`, task);
  
  for (const phase of clone.phases) {
    const target = phase.weeks.find((w) => w.id === week);
    if (target) {
      // Check if task with similar text already exists (prevent duplicates)
      const normalizedNewText = task.text.toLowerCase().trim();
      const existingTask = target.tasks.find(t => 
        t.text.toLowerCase().trim() === normalizedNewText ||
        t.text.toLowerCase().includes(normalizedNewText) ||
        normalizedNewText.includes(t.text.toLowerCase())
      );
      
      if (existingTask) {
        console.log(`⚠️ Task already exists in week ${week}: "${existingTask.text}" - skipping`);
        return clone;
      }
      
      console.log(`Found target week ${week} in phase ${phase.id}, adding task`);
      target.tasks.push({
        id: taskId,
        text: task.text,
        time: task.estimatedMinutes ? `${Math.round(task.estimatedMinutes / 60) || 1} hr` : '1 hr',
        estimatedMinutes: task.estimatedMinutes,
        category: task.category,
      });
      console.log(`Task added. Week now has ${target.tasks.length} tasks`);
      return clone;
    }
  }

  console.warn(`Could not find week ${week} in curriculum`);
  return clone;
}

function deleteTaskById(curriculum: Curriculum, taskId: string): Curriculum {
  const clone = deepClone(curriculum);
  console.log(`Deleting task: ${taskId}`);
  
  for (const phase of clone.phases) {
    for (const week of phase.weeks) {
      const taskIndex = week.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex >= 0) {
        console.log(`Found and removing task ${taskId} from week ${week.id}`);
        week.tasks.splice(taskIndex, 1);
        return clone;
      }
    }
  }

  console.warn(`Could not find task ${taskId} to delete`);
  return clone;
}

export async function persistProgress(
  progress: TaskProgress,
  hoursPerWeekTarget?: number,
  focusAreas?: string[],
  userId = 'default',
) {
  const updatedAt = new Date().toISOString();
  const payload: any = { taskProgress: progress, updatedAt };
  if (hoursPerWeekTarget !== undefined) payload.hoursPerWeekTarget = hoursPerWeekTarget;
  if (focusAreas !== undefined) payload.focusAreas = focusAreas;
  const cleaned = JSON.parse(JSON.stringify(payload));
  await setDoc(doc(db, 'userProgress', userId), cleaned, { merge: true });
}

export async function persistCurriculum(curriculum: Curriculum) {
  const cleaned = JSON.parse(JSON.stringify(curriculum));
  await setDoc(
    doc(db, 'curriculum', 'main'),
    { phases: cleaned.phases, lastUpdated: new Date().toISOString() },
    { merge: true },
  );
}

