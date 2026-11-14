from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.llms_outputs import RouteOption

# The two execution modes the user can pick at the gate.
Mode = Literal["mastery", "efficiency"]


class MessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ProcessPromptRequest(BaseModel):
    """Sent on every user message."""
    user_prompt: str = Field(..., min_length=1, max_length=20000)
    active_mode: Mode | None = None
    history: list[MessageItem] = Field(default_factory=list, max_length=50)
    # Context of the active cycle, echoed back by the frontend on every message
    # so the executor keeps the skill in view for the whole task.
    detected_task: str | None = None
    extracted_skill: str | None = None


class ExecuteRequest(BaseModel):
    """Sent when the user picks a route at the gate."""
    user_prompt: str = Field(..., min_length=1, max_length=20000)
    selected_mode: Mode
    # Context from the gate, so the execution agent knows what is at stake.
    detected_task: str | None = None
    extracted_skill: str | None = None


class ProcessPromptResponse(BaseModel):
    """Returned by both endpoints: either the gate, or an answer."""
    needs_gate: bool

    # Context of the current cycle. Set on the gate, then echoed back on every
    # answer so the frontend can keep sending it.
    detected_task: str | None = None
    extracted_skill: str | None = None

    # Present only when needs_gate is True.
    intro_message: str | None = None
    mastery_route: RouteOption | None = None
    efficiency_route: RouteOption | None = None

    # Present only when needs_gate is False.
    execution_response: str | None = None

    # The mode the frontend should send back on the next message.
    # None while the gate is open (the user has not chosen yet).
    active_mode: Mode | None = None

    @model_validator(mode="after")
    def check_shape(self):
        """The response is either a gate or an answer, never a broken half of one."""
        if self.needs_gate:
            if not (self.intro_message and self.mastery_route and self.efficiency_route):
                raise ValueError("A gate response needs intro_message and both routes.")
        elif not self.execution_response:
            raise ValueError("A non-gate response needs an execution_response.")
        return self