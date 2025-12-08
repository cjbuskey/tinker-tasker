import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runCoachAgent } from './coachAgent';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const coachAgent = functions.https.onCall(async (data: any, context: any) => {
  const userId = context?.auth?.uid ?? 'default';
  const userMessage: string =
    (data && typeof data.message === 'string' && data.message) ||
    (data && data.data && typeof data.data.message === 'string' && data.data.message) ||
    '';

  if (!userMessage) {
    throw new functions.https.HttpsError('invalid-argument', 'message is required');
  }

  try {
    const result = await runCoachAgent(userId, userMessage);
    return result;
  } catch (err: any) {
    console.error('coachAgent error', err);
    throw new functions.https.HttpsError('internal', err?.message || 'Unknown error');
  }
});

