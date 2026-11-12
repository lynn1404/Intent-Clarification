import logging

from app.agents.intent_gate import analyze_intent_and_cycle
from app.agents.execution import execute_chat_response
from app.schemas import Mode, ProcessPromptRequest, ProcessPromptResponse

logger = logging.getLogger(__name__)

# Used when a mode is required but none was ever chosen (rare, see Case B).
# Efficiency is the safe default: never force a Socratic loop on a user who
# did not ask for one.
FALLBACK_MODE: Mode = "efficiency"

async def evaluate_and_route(request: ProcessPromptRequest) -> ProcessPromptResponse:
    """
    Decide what happens with an incoming prompt:
      1. Surface the Intent Clarification Gate (new task cycle), or
      2. Execute directly under the active mode (continuation).
    """
    intent = await analyze_intent_and_cycle(request.user_prompt, request.history)

    # Case A: new task cycle -> reset the mode and surface the gate.
    if intent.is_new_cycle:
        logger.info("New cycle detected. Skill: %r", intent.extracted_skill)
        return ProcessPromptResponse(
            needs_gate=True,
            detected_task=intent.detected_task,
            extracted_skill=intent.extracted_skill,
            intro_message=intent.intro_message,
            mastery_route=intent.mastery_route,
            efficiency_route=intent.efficiency_route,
            active_mode=None,
        )

    # Case B: continuation, but no mode is set. This should not normally happen
    # (the frontend stores the mode after the gate), so it means the mode was
    # lost or the user skipped the gate. We cannot show a gate here because a
    # continuation carries no routes, so we execute under the fallback.
    mode = request.active_mode
    if mode is None:
        logger.warning("Continuation with no active_mode. Falling back to %s.", FALLBACK_MODE)
        mode = FALLBACK_MODE

    # Case C: continuation with a known mode -> bypass the gate and answer.
    execution_output = await execute_chat_response(
        user_prompt=request.user_prompt,
        mode=mode,
        history=request.history,
        detected_task=request.detected_task,
        extracted_skill=request.extracted_skill,
    )

    return ProcessPromptResponse(
        needs_gate=False,
        execution_response=execution_output,
        active_mode=mode,
        # Echo the cycle context so the frontend keeps sending it.
        detected_task=request.detected_task,
        extracted_skill=request.extracted_skill,
    )