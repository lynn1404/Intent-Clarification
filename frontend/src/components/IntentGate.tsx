import React from 'react';
import type { GateData, Mode, RouteOption } from '../types';
import { BookIcon, BoltIcon } from './Icons';
import { Markdown } from './Markdown';

interface IntentGateProps {
  gate: GateData;
  // The route picked on this gate, or null while it is still open.
  choice: Mode | null;
  onSelectMode: (mode: Mode) => void;
  disabled: boolean;
}

const ROUTES: { mode: Mode; label: string; Icon: React.FC }[] = [
  { mode: 'mastery', label: 'Mastery', Icon: BookIcon },
  { mode: 'efficiency', label: 'Efficiency', Icon: BoltIcon },
];

// Locates the first case-insensitive mention of `phrase` in `text`.
function findSpan(text: string, phrase: string | null): [number, number] | null {
  const needle = phrase?.trim();
  if (!needle) return null;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  return at === -1 ? null : [at, at + needle.length];
}

// Emboldens the first mention of the detected task and italicises and emboldens
// the first mention of the skill in the intro message.
function emphasiseIntro(intro: string, task: string | null, skill: string | null): string {
  const taskSpan = findSpan(intro, task);
  const skillSpan = findSpan(intro, skill);
  const marks: [number, string][] = [];

  const skillInTask =
    taskSpan && skillSpan && skillSpan[0] >= taskSpan[0] && skillSpan[1] <= taskSpan[1];
  const overlaps =
    taskSpan && skillSpan && skillSpan[0] < taskSpan[1] && taskSpan[0] < skillSpan[1];

  if (taskSpan && (!overlaps || skillInTask)) {
    marks.push([taskSpan[0], '**'], [taskSpan[1], '**']);
  }
  if (skillSpan) {
    // Inside the bold task the skill only needs italics to stand out.
    const mark = skillInTask ? '*' : '***';
    marks.push([skillSpan[0], mark], [skillSpan[1], mark]);
  }

  // Insert from the end so earlier offsets stay valid.
  return marks
    .sort((a, b) => b[0] - a[0])
    .reduce((s, [at, mark]) => s.slice(0, at) + mark + s.slice(at), intro);
}

// Shown in the thread as an assistant reply: the intro message, then the two routes.
export const IntentGate: React.FC<IntentGateProps> = ({
  gate,
  choice,
  onSelectMode,
  disabled,
}) => {
  const routes: Record<Mode, RouteOption> = {
    mastery: gate.masteryRoute,
    efficiency: gate.efficiencyRoute,
  };

  return (
    <div className="msg-assistant">
      <div className="assistant-text">
        <div className="gate-intro">
          <Markdown content={emphasiseIntro(gate.introMessage, gate.detectedTask, gate.extractedSkill)} />
        </div>

        <div className="choice-grid" role="group" aria-label="Choose how to proceed">
          {ROUTES.map(({ mode, label, Icon }) => {
            const state = choice === null ? '' : choice === mode ? 'selected' : 'dimmed';
            return (
              <button
                key={mode}
                type="button"
                className={`choice-card ${mode} ${state}`}
                disabled={disabled}
                aria-pressed={choice === mode}
                onClick={() => onSelectMode(mode)}
              >
                <span className="option-tag">
                  <Icon />
                  {label}
                </span>
                <span className="option-label">{routes[mode].label}</span>
                <span className="option-subtext">{routes[mode].subtext}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
