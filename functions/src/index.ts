import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { runCoachAgent } from './coachAgent';

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({ secrets: ['ANTHROPIC_API_KEY'] });

export const coachAgent = onCall(async (request) => {
  const userId = request.auth?.uid ?? 'default';
  const userMessage: string =
    (request.data && typeof request.data.message === 'string' && request.data.message) || '';

  if (!userMessage) {
    throw new HttpsError('invalid-argument', 'message is required');
  }

  try {
    const result = await runCoachAgent(userId, userMessage);
    return result;
  } catch (err: any) {
    console.error('coachAgent error', err);
    throw new HttpsError('internal', err?.message || 'Unknown error');
  }
});

