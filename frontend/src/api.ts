import type {
  ProcessPromptRequest,
  ProcessPromptResponse,
  ExecuteRequest,
} from './types';

// Relative: the Vite dev server proxies /api to the backend (see vite.config.ts).
const API_BASE_URL = '/api';

const NETWORK_ERROR = 'Cannot reach the server. Check that the backend is running, then try again.';

async function post<T>(path: string, payload: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // fetch only throws when no response arrives at all (server down, no network).
    throw new Error(NETWORK_ERROR);
  }

  if (!res.ok) {
    // The backend always answers errors as JSON {code, detail}, with a detail that is
    // safe to show. A non-JSON error comes from something in between: in dev, the Vite
    // proxy answers 502 with an empty body when the backend is down.
    let message = NETWORK_ERROR;
    let body: unknown = null;
    try {
      body = await res.json();
      const detail = (body as { detail?: unknown } | null)?.detail;
      // A 422 carries a list of validation errors, not a sentence.
      message = typeof detail === 'string' ? detail : 'The server rejected the request.';
    } catch {
      // Not JSON: keep the network message.
    }
    if (import.meta.env.DEV) {
      console.error(`[api] POST ${path} → ${res.status}`, { request: payload, response: body });
    }
    throw new Error(message);
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

export function executePrompt(
  payload: ExecuteRequest
): Promise<ProcessPromptResponse> {
  return post('/execute', payload);
}
