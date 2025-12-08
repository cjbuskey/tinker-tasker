import { httpsCallable, getFunctions } from 'firebase/functions';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import app, { db } from '../firebase';
import { AgentOperation, AgentResponse, CoachMessage } from '../types/coach';

export async function sendCoachMessage(message: string): Promise<AgentResponse> {
  const functions = getFunctions(app);
  const callable = httpsCallable<{ message: string }, AgentResponse>(functions, 'coachAgent');
  const res = await callable({ message });
  return res.data;
}

export async function loadConversation(userId = 'default'): Promise<CoachMessage[]> {
  const ref = doc(db, 'coachConversations', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as { messages?: CoachMessage[] };
  return data.messages || [];
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
  let updatedCurriculum = deepClone(curriculum);
  const updatedProgress: TaskProgress = { ...taskProgress };

  for (const op of operations) {
    if (op.type === 'update_status') {
      updatedProgress[op.taskId] = { ...(updatedProgress[op.taskId] || {}), status: op.status };
    }

    if (op.type === 'reschedule') {
      updatedCurriculum = rescheduleTask(updatedCurriculum, op.taskId, op.newWeek);
    }

    if (op.type === 'add_task') {
      updatedCurriculum = addTaskToWeek(updatedCurriculum, op.week, op.task);
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

function addTaskToWeek(
  curriculum: Curriculum,
  week: number,
  task: { id?: string; text: string; estimatedMinutes?: number; category?: string },
): Curriculum {
  const clone = deepClone(curriculum);
  const taskId = task.id || `auto-${Date.now()}`;

  for (const phase of clone.phases) {
    const target = phase.weeks.find((w) => w.id === week);
    if (target) {
      target.tasks.push({
        id: taskId,
        text: task.text,
        time: task.estimatedMinutes ? `${Math.round(task.estimatedMinutes / 60) || 1} hr` : '1 hr',
        estimatedMinutes: task.estimatedMinutes,
        category: task.category,
      });
      return clone;
    }
  }

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

