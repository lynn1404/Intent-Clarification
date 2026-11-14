import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { GateData, MessageItem, Mode } from './types';
import { processPrompt, executePrompt } from './api';
import { IntentGate } from './components/IntentGate';
import { SendIcon } from './components/Icons';
import { Markdown } from './components/Markdown';
import './index.css';

// Context of the active task cycle, set by the gate and echoed on every message.
interface CycleContext {
  detectedTask: string | null;
  extractedSkill: string | null;
}

// What the thread shows. Gates are UI only: they never go into the history
// sent to the backend.
type ThreadItem =
  | { kind: 'message'; message: MessageItem }
  | { kind: 'gate'; gate: GateData; choice: Mode | null };

const EMPTY_CYCLE: CycleContext = { detectedTask: null, extractedSkill: null };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// History for the backend: only the current cycle. A gate starts a new task, so
// the cycle begins at the user prompt that opened the most recent gate; anything
// before it stays in the thread but is no longer sent.
function toHistory(items: ThreadItem[]): MessageItem[] {
  let lastGate = -1;
  items.forEach((item, i) => {
    if (item.kind === 'gate') lastGate = i;
  });
  const cycleStart = Math.max(lastGate - 1, 0);
  return items
    .slice(cycleStart)
    .flatMap((item) => (item.kind === 'message' ? [item.message] : []));
}

function messageItem(role: MessageItem['role'], content: string): ThreadItem {
  return { kind: 'message', message: { role, content } };
}

// Set the choice on the gate at `index`.
function withChoice(items: ThreadItem[], index: number, choice: Mode | null): ThreadItem[] {
  return items.map((item, i) =>
    i === index && item.kind === 'gate' ? { ...item, choice } : item
  );
}

export default function App() {
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [cycle, setCycle] = useState<CycleContext>(EMPTY_CYCLE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The gate waiting for a choice, if any. It is always the last item.
  const lastItem = items[items.length - 1];
  const gateOpen = lastItem?.kind === 'gate' && lastItem.choice === null;

  // Keep the latest item in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, isLoading]);

  // Grow the input with its content, up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputPrompt]);

  // Submit prompt to backend
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userText = inputPrompt.trim();
    if (!userText || isLoading || gateOpen) return;

    const priorItems = items;
    const withUser = [...priorItems, messageItem('user', userText)];
    setInputPrompt('');
    setError(null);
    setIsLoading(true);
    setItems(withUser);

    try {
      const response = await processPrompt({
        user_prompt: userText,
        active_mode: activeMode,
        history: toHistory(priorItems),
        detected_task: cycle.detectedTask,
        extracted_skill: cycle.extractedSkill,
      });

      setCycle({
        detectedTask: response.detected_task,
        extractedSkill: response.extracted_skill,
      });

      if (response.needs_gate) {
        // New cycle: the previous mode no longer applies until the user picks one.
        setActiveMode(null);
        const gate: GateData = {
          userPrompt: userText,
          detectedTask: response.detected_task,
          extractedSkill: response.extracted_skill,
          introMessage: response.intro_message ?? 'How would you like to proceed?',
          masteryRoute: response.mastery_route ?? {
            label: 'Learn through this task',
            subtext: 'Get directions and guidance as you work through it.',
          },
          efficiencyRoute: response.efficiency_route ?? {
            label: 'Get the result directly',
            subtext: 'I just need the deliverable directly.',
          },
        };
        setItems([...withUser, { kind: 'gate', gate, choice: null }]);
      } else {
        setItems([...withUser, messageItem('assistant', response.execution_response ?? '')]);
        setActiveMode(response.active_mode);
      }
    } catch (err) {
      console.error('Error processing prompt:', err);
      // Roll back the unsent message so the user can retry it.
      setItems(priorItems);
      setInputPrompt(userText);
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Enter sends, Shift+Enter adds a new line.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  // User picks a route on the open gate
  const handleSelectMode = async (selectedMode: Mode) => {
    if (lastItem?.kind !== 'gate' || lastItem.choice !== null || isLoading) return;
    const gateIndex = items.length - 1;
    const { gate } = lastItem;

    setError(null);
    setIsLoading(true);
    // Show the choice right away; undone below if the request fails.
    setItems(withChoice(items, gateIndex, selectedMode));

    try {
      const response = await executePrompt({
        user_prompt: gate.userPrompt,
        selected_mode: selectedMode,
        detected_task: gate.detectedTask,
        extracted_skill: gate.extractedSkill,
      });

      setActiveMode(response.active_mode ?? selectedMode);
      setCycle({
        detectedTask: response.detected_task,
        extractedSkill: response.extracted_skill,
      });
      setItems((prev) => [
        ...prev,
        messageItem('assistant', response.execution_response ?? ''),
      ]);
    } catch (err) {
      console.error('Error confirming gate choice:', err);
      // Reopen the gate so the user can pick again.
      setItems((prev) => withChoice(prev, gateIndex, null));
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const isEmpty = items.length === 0;
  const inputLocked = isLoading || gateOpen;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Adaptive Assistant</span>
        <div className="topbar-right">
          {cycle.extractedSkill && (
            <span className="skill-chip" title={cycle.detectedTask ?? undefined}>
              {cycle.extractedSkill}
            </span>
          )}
          {activeMode && (
            <span className={`mode-pill ${activeMode}`}>
              <span className="mode-dot" />
              {activeMode === 'mastery' ? 'Mastery' : 'Efficiency'}
            </span>
          )}
        </div>
      </header>

      <main className="conversation">
        {isEmpty ? (
          <div className="welcome">
            <h1 className="greeting">
              <span className="greeting-strong">Hello there</span>
              <br />
              What would you like to work on?
            </h1>
          </div>
        ) : (
          <div className="thread">
            {items.map((item, index) => {
              if (item.kind === 'gate') {
                return (
                  <IntentGate
                    key={index}
                    gate={item.gate}
                    choice={item.choice}
                    onSelectMode={handleSelectMode}
                    disabled={isLoading || item.choice !== null}
                  />
                );
              }
              const { message } = item;
              return message.role === 'user' ? (
                <div key={index} className="msg-user">
                  <div className="bubble">{message.content}</div>
                </div>
              ) : (
                <div key={index} className="msg-assistant">
                  <div className="assistant-text">
                    <Markdown content={message.content} />
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="msg-assistant">
                <div className="shimmer">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <footer className="composer-wrap">
        {error && <div className="error-banner">{error}</div>}

        <form ref={formRef} onSubmit={handleSubmit} className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            className="composer-input"
            placeholder={gateOpen ? 'Choose an option above to continue' : 'Ask anything'}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inputLocked}
          />
          <button
            type="submit"
            className="send-btn"
            aria-label="Send"
            disabled={inputLocked || !inputPrompt.trim()}
          >
            <SendIcon />
          </button>
        </form>
        <p className="disclaimer">
          Pick a route at the start of each task: learn through it, or get the result directly.
        </p>
      </footer>
    </div>
  );
}
