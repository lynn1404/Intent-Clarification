import logging

from fastapi import APIRouter

from app.agents import execute_chat_response
from app.agents import evaluate_and_route
from app.schemas import (
    ConfirmGateChoiceRequest,
    ProcessPromptRequest,
    ProcessPromptResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/process-prompt", response_model=ProcessPromptResponse)
async def process_prompt(request: ProcessPromptRequest):
    """
    Entry point for every user message. Either surfaces the Intent
    Clarification Gate or answers directly under the active route.
    """
    logger.info(
        "[process-prompt] mode=%s history=%d chars=%d",
        request.active_mode, len(request.history), len(request.user_prompt),
    )
    response = await evaluate_and_route(request)
    logger.info(
        "[process-prompt] needs_gate=%s skill=%r",
        response.needs_gate, response.extracted_skill,
    )
    return response


@router.post("/execute", response_model=ProcessPromptResponse)
async def execute(request: ConfirmGateChoiceRequest):
    """
    Called when the user picks a route at the gate. Locks the route and
    generates the first answer of the cycle.
    """
    logger.info(
        "[execute] route=%s skill=%r",
        request.selected_mode, request.extracted_skill,
    )
    execution_output = await execute_chat_response(
        user_prompt=request.user_prompt,
        mode=request.selected_mode,
        # A gate only fires on a new cycle, so the previous conversation is
        # a different task. Starting clean keeps its artifacts and style out
        # of this one.
        history=[],
        detected_task=request.detected_task,
        extracted_skill=request.extracted_skill,
    )
    return ProcessPromptResponse(
        needs_gate=False,
        execution_response=execution_output,
        active_mode=request.selected_mode,
        # Echo the cycle context so the frontend keeps sending it.
        detected_task=request.detected_task,
        extracted_skill=request.extracted_skill,
    )
