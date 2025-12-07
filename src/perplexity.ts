// Perplexity API integration
const PERPLEXITY_API_KEY = process.env.REACT_APP_PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

export interface PerplexitySearchResult {
  content: string;
  citations?: string[];
}

export async function searchWithPerplexity(query: string): Promise<PerplexitySearchResult> {
  if (!PERPLEXITY_API_KEY || PERPLEXITY_API_KEY === 'YOUR_PERPLEXITY_API_KEY_HERE') {
    throw new Error('Perplexity API key not configured. Please add REACT_APP_PERPLEXITY_API_KEY to your .env file.');
  }

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant that provides concise, accurate information with citations. Keep responses brief and focused.'
          },
          {
            role: 'user',
            content: `Provide a brief overview and key resources for: ${query}`
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Perplexity API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'No results found.';
    
    // Extract citations if available
    const citations = data.citations || [];

    return {
      content,
      citations
    };
  } catch (error) {
    console.error('Perplexity search error:', error);
    throw error;
  }
}

