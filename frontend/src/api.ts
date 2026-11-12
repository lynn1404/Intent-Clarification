import type {
  ProcessPromptRequest,
  ProcessPromptResponse,
  ConfirmGateChoiceRequest,
} from './types';

// Relative: the Vite dev server proxies /api to the backend (see vite.config.ts).
const API_BASE_URL = '/api';

async function post<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // FastAPI puts the reason in `detail` (a string, or a list for 422s).
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
      else if (body.detail) detail = JSON.stringify(body.detail);
    } catch {
      // Not JSON; keep the status text.
    }
    if (import.meta.env.DEV) {
      console.error(`[api] POST ${path} → ${res.status}`, { request: payload, detail });
    }
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  if (import.meta.env.DEV) {
    console.groupCollapsed(`[api] POST ${path} → ${res.status}`);
    console.log('request', payload);
    console.log('response', data);
    console.groupEnd();
  }
  return data;
}

export function processPrompt(
  payload: ProcessPromptRequest
): Promise<ProcessPromptResponse> {
  return post('/process-prompt', payload);
}

export function confirmGateChoice(
  payload: ConfirmGateChoiceRequest
): Promise<ProcessPromptResponse> {
  return post('/confirm-gate', payload);
}
