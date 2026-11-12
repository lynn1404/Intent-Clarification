import logging

import openai
from pydantic import ValidationError

from app.config import get_client, settings
from app.prompts.intent_gate import GATE_SYSTEM_PROMPT
from app.schemas.api_payloads import MessageItem
from app.schemas.llms_outputs import IntentAnalysisResult
from app.utils.timing import log_timing

logger = logging.getLogger(__name__)

# How many past messages the classifier sees. Enough to judge a topic shift
# without paying for the whole conversation.
HISTORY_WINDOW = 4

# The model answered, but the answer is unusable: invalid against the schema, a
# refusal, cut off by the token limit, or blocked by the content filter. Worth one
# retry. Transport and API errors are not listed: the SDK already retries those,
# and they reach the central handlers in api/error_handling.py.
_BAD_OUTPUT = (
    ValidationError,
    ValueError,
    openai.LengthFinishReasonError,
    openai.ContentFilterFinishReasonError,
)


def _build_input(user_prompt: str, history: list[MessageItem]) -> str:
    """Render the inputs in the labeled shape the prompt's examples use, so the
    model can tell the history apart from the message it must classify."""
    if history:
        transcript = "\n".join(
            f"{msg.role.capitalize()}: {msg.content}"
            for msg in history[-HISTORY_WINDOW:]
        )
    else:
        transcript = "None"

    return f"chat_history:\n{transcript}\n\ncurrent_prompt:\n{user_prompt}"


async def _call_model(messages: list) -> IntentAnalysisResult:
    """One attempt. The API constrains the output to the schema, so there is
    no JSON parsing to do here."""
    completion = await get_client().chat.completions.parse(
        model=settings.GATE_MODEL,
        messages=messages,
        response_format=IntentAnalysisResult,
        temperature=0.1,  # low temperature for deterministic classification
    )

    result = completion.choices[0].message.parsed
    if result is None:
        raise ValueError("The model returned no parsed result (refusal).")
    return result


@log_timing
async def analyze_intent_and_cycle(
    user_prompt: str,
    history: list[MessageItem],
) -> IntentAnalysisResult:
    """
    Classify the prompt as a new cycle or a continuation.

    A bad answer is retried once, then falls back to a continuation so the user
    still gets a reply. OpenAI errors (rate limit, outage, bad key) are not
    caught: they propagate to the central error handlers.
    """
    messages = [
        {"role": "system", "content": GATE_SYSTEM_PROMPT},
        {"role": "user", "content": _build_input(user_prompt, history)},
    ]

    for attempt in (1, 2):
        try:
            return await _call_model(messages)
        except _BAD_OUTPUT as e:
            logger.warning("Intent analysis attempt %d produced a bad result: %s", attempt, e)

    # Both attempts failed. Treat it as a continuation so the conversation
    # keeps moving; the orchestrator answers under the active (or fallback) mode.
    logger.error("Intent analysis failed twice. Defaulting to a continuation.")
    return IntentAnalysisResult(is_new_cycle=False)
