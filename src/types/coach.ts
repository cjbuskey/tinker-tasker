export type AgentOperation =
  | { type: 'update_status'; taskId: string; status: 'todo' | 'in_progress' | 'done' | 'skipped' }
  | { type: 'reschedule'; taskId: string; newWeek: number }
  | { type: 'add_task'; week: number; task: { id?: string; text: string; estimatedMinutes?: number; category?: string } };

export type WeeklyPlan = {
  week: number;
  tasks: string[];
  estimatedMinutes?: number;
};

export type AgentResponse = {
  message: string;
  operations: AgentOperation[];
  weeklyPlan?: WeeklyPlan;
};

export type CoachMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  operations?: AgentOperation[];
  weeklyPlan?: WeeklyPlan;
};

