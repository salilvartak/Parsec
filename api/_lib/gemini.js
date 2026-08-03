// Thin wrapper over the Gemini REST generateContent endpoint.
//
// Deliberately not using @google/genai: this runs in a serverless function
// where bundle size is cold-start latency, the REST shape is stable, and the
// SDK's newer Interactions surface does not clearly cover the flash-lite models
// we target. One fetch is easier to reason about than an SDK version pin.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  constructor(message, { status, retryable }) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

// → parsed JSON object from the model's response
export async function generateJson({
  model, system, prompt, schema, maxOutputTokens, thinkingBudget = 0, signal,
}) {
  const generationConfig = {
    responseMimeType: 'application/json',
    maxOutputTokens,
    temperature: 0,
    thinkingConfig: { thinkingBudget },
  };
  // Only constrain the shape when we know it. Mock generation produces
  // arbitrary user-shaped JSON, and forcing it through a wrapper schema would
  // mean paying escaping overhead on every generated value.
  if (schema) generationConfig.responseSchema = schema;

  const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 429 = we outran Google's quota despite our own limiter; 5xx = their
    // problem. Both mean the user's slot should be refunded and retried.
    throw new GeminiError(
      `Gemini ${res.status}: ${body.slice(0, 300)}`,
      { status: res.status, retryable: res.status === 429 || res.status >= 500 },
    );
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text).join('') ?? '';

  if (!text) {
    // A blocked prompt or a hit output ceiling both land here. finishReason
    // tells them apart and is worth surfacing — "MAX_TOKENS" means the caller
    // should shrink the input, not retry.
    throw new GeminiError(
      `Gemini returned no content (finishReason: ${candidate?.finishReason ?? 'unknown'})`,
      { status: 502, retryable: false },
    );
  }

  try {
    return { value: JSON.parse(text), usage: data.usageMetadata ?? null };
  } catch {
    throw new GeminiError('Gemini returned malformed JSON', { status: 502, retryable: true });
  }
}
