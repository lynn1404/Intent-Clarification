import logging

from app.config import get_client, settings
from app.prompts.execution import EXECUTION_SYSTEM_PROMPT, GATE_CONTEXT_TEMPLATE
from app.schemas.api_payloads import MessageItem, Mode
from app.utils.timing import log_timing

logger = logging.getLogger(__name__)

# Mastery coaches in open conversation; efficiency delivers a precise result.
TEMPERATURE: dict[Mode, float] = {"mastery": 0.7, "efficiency": 0.2}


@log_timing
async def execute_chat_response(
    user_prompt: str,
    mode: Mode,
    history: list[MessageItem],
    detected_task: str | None = None,
    extracted_skill: str | None = None,
) -> str:
    """Answer the user under the chosen route. Returns the reply as markdown."""
    # Reinject the gate context so the executor follows the chosen route and
    # keeps the skill in view for the whole cycle.
    gate_context = GATE_CONTEXT_TEMPLATE.format(
        selected_route=mode,
        detected_task=detected_task or "not specified",
        extracted_skill=extracted_skill or "not specified",
    )

    messages = [{"role": "system", "content": EXECUTION_SYSTEM_PROMPT + gate_context}]
    messages += [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": user_prompt})

    response = await get_client().chat.completions.create(
        model=settings.EXECUTION_MODEL,
        messages=messages,
        temperature=TEMPERATURE[mode],
    )

    content = response.choices[0].message.content
    if not content:
        # A refusal or empty generation would otherwise fail response validation.
        raise ValueError("The model returned an empty response.")

    logger.info("execute: mode=%s history=%d -> %d chars", mode, len(history), len(content))
    return content
