import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('ANTHROPIC_API_KEY is not set. Cloud Function will fail at runtime.');
}

export const anthropic = new Anthropic({
  apiKey: apiKey || '',
});

