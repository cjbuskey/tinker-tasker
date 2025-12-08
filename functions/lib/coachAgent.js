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
function trimHistory(history) {
    const sorted = [...history].sort((a, b) => a.createdAt - b.createdAt);
    const last = sorted.slice(-8);
    return last;
}
async function runCoachAgent(userId, userMessage) {
    const [curriculum, progress, history] = await Promise.all([
        fetchCurriculum(),
        fetchUserProgress(userId),
        fetchConversation(userId),
    ]);
    const prompt = buildSystemPrompt(curriculum, progress);
    const convo = trimHistory(history);
    const response = await anthropic_1.anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        temperature: 0.3,
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
            parsed = JSON.parse(content.text);
        }
        catch (err) {
            // Try to salvage JSON embedded in text
            const maybeJson = content.text?.match(/\{[\s\S]*\}/);
            if (maybeJson) {
                try {
                    parsed = JSON.parse(maybeJson[0]);
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
