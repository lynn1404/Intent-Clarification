// Mirrors backend/app/schema/api.py.

export type Mode = 'mastery' | 'efficiency';

// One of the two choices shown at the gate.
export interface RouteOption {
  label: string;
  subtext: string;
}

export interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProcessPromptRequest {
  user_prompt: string;
  active_mode: Mode | null;
  history: MessageItem[];
  // Context of the active cycle, echoed back on every message.
  detected_task: string | null;
  extracted_skill: string | null;
}

export interface ConfirmGateChoiceRequest {
  user_prompt: string;
  selected_mode: Mode;
  history: MessageItem[];
  detected_task: string | null;
  extracted_skill: string | null;
}

export interface ProcessPromptResponse {
  needs_gate: boolean;

  // Context of the current cycle.
  detected_task: string | null;
  extracted_skill: string | null;

  // Present only when needs_gate is true.
  intro_message: string | null;
  mastery_route: RouteOption | null;
  efficiency_route: RouteOption | null;

  // Present only when needs_gate is false.
  execution_response: string | null;

  // Mode to send back on the next message. Null while the gate is open.
  active_mode: Mode | null;
}

// A gate response with every field the gate UI needs.
export interface GateData {
  userPrompt: string;
  detectedTask: string | null;
  extractedSkill: string | null;
  introMessage: string;
  masteryRoute: RouteOption;
  efficiencyRoute: RouteOption;
}
