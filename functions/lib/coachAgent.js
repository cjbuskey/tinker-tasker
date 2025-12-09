"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCoachAgent = runCoachAgent;
const admin = __importStar(require("firebase-admin"));
const anthropic_1 = require("./anthropic");
// Ensure admin is initialized even if this module is imported before index.ts runs
if (!admin.apps.length) {
    admin.initializeApp();
}
// Default to a widely available model; override via secret/env ANTHROPIC_MODEL
// Examples: claude-3-5-sonnet-20240620, claude-3-opus-20240229, claude-3-haiku-20240307
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
const db = admin.firestore();
async function fetchCurriculum() {
    const snap = await db.doc('curriculum/main').get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return { phases: data.phases };
}
async function fetchUserProgress(userId) {
    const snap = await db.doc(`userProgress/${userId}`).get();
    if (!snap.exists)
        return {};
    return snap.data();
}
async function fetchConversation(userId) {
    const snap = await db.doc(`coachConversations/${userId}`).get();
    if (!snap.exists)
        return [];
    const data = snap.data();
    return data.messages || [];
}
function cleanMessage(message) {
    const cleaned = { ...message };
    if (cleaned.weeklyPlan === undefined)
        delete cleaned.weeklyPlan;
    if (cleaned.operations === undefined)
        delete cleaned.operations;
    // Guard against undefined inside weeklyPlan (e.g., estimatedMinutes)
    if (cleaned.weeklyPlan) {
        if (cleaned.weeklyPlan.estimatedMinutes === undefined) {
            delete cleaned.weeklyPlan.estimatedMinutes;
        }
    }
    return cleaned;
}
async function saveConversation(userId, messages) {
    const cleanedMessages = messages.map(cleanMessage);
    await db.doc(`coachConversations/${userId}`).set({
        messages: cleanedMessages,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
function buildSystemPrompt(curriculum, progress) {
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
- delete_task: { "type": "delete_task", "taskId": "w1t1" }

CRITICAL CONVERSATION RULES:
1. READ THE ENTIRE CONVERSATION HISTORY before responding
2. If user asks for "more", "additional", "anything else", or "what else" - SUGGEST NEW ITEMS, don't repeat what you already said
3. If you already suggested tasks X, Y, Z and user asks "anything else?", suggest tasks A, B, C from the curriculum
4. Reference your previous suggestions explicitly: "In addition to the X, Y, Z I mentioned, you could also..."
5. Be conversationally aware - if user is asking a follow-up, acknowledge what was discussed before

CONFIRMATION PROTOCOL:
6. When user asks "what tasks could I add?" or "what should I remove?":
   - IMMEDIATELY suggest specific tasks in your first response
   - Include "weeklyPlan" showing the proposed changes
   - Do NOT include "operations" array in this response
   - Format your message with markdown bullets
   - End with: "Shall I add these tasks to Week X?"
   
7. When user CONFIRMS (says "yes", "do it", "add them", "sure", or clicks Yes button):
   - NOW include the "operations" array to apply the changes
   - Do NOT include "weeklyPlan" in confirmation response
   - Keep message simple: "✓ I've added 4 tasks to Week 1."
   - Do NOT repeat the task list or show JSON
   
8. If user rejects, acknowledge and do not send operations.

MESSAGE FORMATTING:
- Use clear markdown formatting in "message" field
- Use bullet points (- ) for lists of tasks
- Use **bold** for emphasis
- Write naturally, like talking to a colleague
- NEVER output raw JSON structures with curly braces in the message
- Example GOOD proposal: "Here are some tasks you could add:\n\n- **Add Logging**: Track server usage (90 min)\n- **Add Auth**: Secure your API (2.5 hrs)\n\nShall I add these to Week 1?"
- Example GOOD confirmation: "✓ I've added 4 tasks to Week 1. They're ready for you to work on!"
- Example BAD: Showing any JSON with { } or operations arrays in the message text

TASK DETAILS:
- In "message", explain WHAT tasks you're recommending with full task names/descriptions using markdown
- In "weeklyPlan.tasks", use FULL task text from curriculum, NOT just task IDs
- Be specific: reference actual task names like "Set up MCP dev environment" not "w1t1"
- Check user's current progress (statuses) before suggesting changes`,
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
function trimHistory(history) {
    const sorted = [...history].sort((a, b) => a.createdAt - b.createdAt);
    const last = sorted.slice(-12); // Keep more context
    return last;
}
// Check if user message is an affirmative response (confirming a suggestion)
function isAffirmative(message) {
    return /\b(yes|sure|do it|add them|add it|add these|please add|ok|okay|sounds good|go ahead|confirm|yep|yeah)\b/i.test(message || '');
}
// Derive operations from a weeklyPlan when model forgets to include them
function deriveOperationsFromPlan(plan) {
    if (!plan || !plan.tasks || !Array.isArray(plan.tasks)) {
        return [];
    }
    const estimatedPerTask = plan.estimatedMinutes
        ? Math.floor(plan.estimatedMinutes / plan.tasks.length)
        : 60;
    return plan.tasks.map((text) => ({
        type: 'add_task',
        week: plan.week,
        task: {
            text,
            estimatedMinutes: estimatedPerTask,
        },
    }));
}
// Extract tasks from message text when weeklyPlan is missing
function extractTasksFromMessage(message, defaultWeek = 1) {
    // Look for bullet points with task descriptions
    // Matches patterns like: "- **Task name** (1 hr)" or "- Task name (90 min)" or "- **Task**: description"
    const taskPattern = /[-•]\s*\*?\*?([^*\n(]+?)(?:\*?\*?)(?:\s*\(([^)]+)\)|\s*:|\s*$)/gm;
    const tasks = [];
    let totalMinutes = 0;
    let match;
    while ((match = taskPattern.exec(message)) !== null) {
        const taskText = match[1].trim();
        const timeStr = (match[2] || '').toLowerCase();
        if (taskText.length > 5 && !taskText.toLowerCase().includes('shall i')) { // Avoid false positives
            tasks.push(taskText);
            // Parse time estimate if available
            if (timeStr.includes('hr') || timeStr.includes('hour')) {
                const hrs = parseFloat(timeStr) || 1;
                totalMinutes += hrs * 60;
            }
            else if (timeStr.includes('min')) {
                totalMinutes += parseInt(timeStr) || 60;
            }
            else {
                totalMinutes += 60; // Default 1 hour
            }
        }
    }
    if (tasks.length === 0)
        return null;
    return {
        week: defaultWeek,
        tasks,
        estimatedMinutes: totalMinutes || tasks.length * 60,
    };
}
async function runCoachAgent(userId, userMessage) {
    const [curriculum, progress, history] = await Promise.all([
        fetchCurriculum(),
        fetchUserProgress(userId),
        fetchConversation(userId),
    ]);
    const prompt = buildSystemPrompt(curriculum, progress);
    const convo = trimHistory(history);
    // Add conversation context reminder
    if (convo.length > 0) {
        const recentContext = convo.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`).join('\n');
        prompt.push({
            role: 'system',
            content: `RECENT CONVERSATION CONTEXT (last few exchanges):\n${recentContext}\n\nRemember: Build on this context. Don't repeat what you already said. If user asks for "more" or "anything else", provide NEW suggestions.`
        });
    }
    const response = await anthropic_1.anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        temperature: 0.2,
        system: prompt.map((p) => p.content).join('\n\n'),
        messages: [
            ...convo.map((m) => ({
                role: (m.role === 'assistant' ? 'assistant' : 'user'),
                content: m.content,
            })),
            { role: 'user', content: userMessage },
        ],
    });
    const content = response.content[0];
    let parsed = { message: 'No response', operations: [] };
    if (content.type === 'text') {
        try {
            const rawParsed = JSON.parse(content.text);
            parsed = {
                message: rawParsed.message || 'No response',
                operations: rawParsed.operations || [],
                weeklyPlan: rawParsed.weeklyPlan,
            };
        }
        catch (err) {
            // Try to salvage JSON embedded in text
            const maybeJson = content.text?.match(/\{[\s\S]*\}/);
            if (maybeJson) {
                try {
                    const rawParsed = JSON.parse(maybeJson[0]);
                    parsed = {
                        message: rawParsed.message || 'No response',
                        operations: rawParsed.operations || [],
                        weeklyPlan: rawParsed.weeklyPlan,
                    };
                }
                catch {
                    parsed = {
                        message: content.text || 'Coach could not parse a response.',
                        operations: [],
                    };
                }
            }
            else {
                parsed = {
                    message: content.text || 'Coach could not parse a response.',
                    operations: [],
                };
            }
        }
    }
    // Ensure message is never undefined (Firestore doesn't allow undefined values)
    if (!parsed.message) {
        parsed.message = 'No response';
    }
    // FALLBACK: If model didn't return weeklyPlan, try to extract tasks from message text
    if (!parsed.weeklyPlan && parsed.message) {
        const extractedPlan = extractTasksFromMessage(parsed.message, 1);
        if (extractedPlan) {
            parsed.weeklyPlan = extractedPlan;
        }
    }
    // FALLBACK: If user confirmed but model forgot to include operations,
    // derive them from the weeklyPlan in this response or previous messages
    const userConfirmed = isAffirmative(userMessage);
    if (userConfirmed && (!parsed.operations || parsed.operations.length === 0)) {
        // Look for weeklyPlan in current response or in recent history
        let lastAssistantPlan = parsed.weeklyPlan ||
            [...history].reverse().find((m) => m.role === 'assistant' && m.weeklyPlan)?.weeklyPlan;
        // LAST RESORT: If no weeklyPlan found, try to extract tasks from the previous message text
        if (!lastAssistantPlan) {
            const lastAssistantMsg = [...history].reverse().find((m) => m.role === 'assistant');
            if (lastAssistantMsg?.content) {
                lastAssistantPlan = extractTasksFromMessage(lastAssistantMsg.content, 1) ?? undefined;
            }
        }
        const derived = deriveOperationsFromPlan(lastAssistantPlan);
        if (derived.length > 0) {
            parsed = { ...parsed, operations: derived, weeklyPlan: undefined };
        }
    }
    const assistantMessage = {
        role: 'assistant',
        content: parsed.message,
        operations: parsed.operations,
        weeklyPlan: parsed.weeklyPlan,
        createdAt: Date.now(),
    };
    const newHistory = [...history, { role: 'user', content: userMessage, createdAt: Date.now() }, assistantMessage];
    await saveConversation(userId, trimHistory(newHistory));
    // Normalize operations to ensure downstream expects "type"
    const normalizedOps = (parsed.operations || []).map((op) => {
        if (op.type)
            return op;
        if (op.operation === 'add_task') {
            return { type: 'add_task', week: op.week, task: op.task };
        }
        if (op.operation === 'update_status') {
            return { type: 'update_status', taskId: op.taskId, status: op.status };
        }
        if (op.operation === 'reschedule') {
            return { type: 'reschedule', taskId: op.taskId, newWeek: op.newWeek };
        }
        return op;
    });
    return { ...parsed, operations: normalizedOps };
}
