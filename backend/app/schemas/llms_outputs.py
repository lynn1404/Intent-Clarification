
from pydantic import BaseModel, model_validator


class RouteOption(BaseModel):
    """One of the two choices shown at the gate."""
    label: str
    subtext: str


class IntentAnalysisResult(BaseModel):
    """Output of the Intent-Analysis Agent (one JSON object per user message)."""

    # True when the user starts a new task cycle. A new cycle triggers the gate.
    # No default: OpenAI strict structured outputs reject `default` in the schema.
    is_new_cycle: bool

    # All fields below are null on a continuation.
    detected_task: str | None = None
    extracted_skill: str | None = None
    intro_message: str | None = None
    mastery_route: RouteOption | None = None
    efficiency_route: RouteOption | None = None

    @model_validator(mode="after")
    def check_gate_is_complete(self):
        """A new cycle must carry everything the gate UI needs to render."""
        if self.is_new_cycle:
            required = [self.detected_task, self.extracted_skill,
                        self.intro_message, self.mastery_route, self.efficiency_route]
            if not all(required):
                raise ValueError(
                    "is_new_cycle=True requires detected_task, extracted_skill, "
                    "intro_message, mastery_route and efficiency_route."
                )
        return self