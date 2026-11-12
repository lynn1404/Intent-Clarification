"""Central error handling: turns exceptions into consistent JSON responses.

Endpoints do not catch exceptions. They propagate here and are mapped by type:
  AppError            -> its own status (expected, user-facing errors we raise on purpose)
  OpenAI errors       -> 429 / 413 / 502 / 503 / 504 depending on the cause
  anything else       -> 500, with the full traceback logged
Every response has the shape {"code": "<machine_readable>", "detail": "<human message>"}.
"""
import logging

import openai
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """An error we raise on purpose. `message` must be safe to show to the user."""

    def __init__(self, message: str, status_code: int = 400, code: str = "bad_request"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def _error(status_code: int, code: str, detail: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "detail": detail},
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all error handlers to the app. Call BEFORE adding CORSMiddleware."""

    # --- Errors we raise on purpose -------------------------------------------------
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        logger.info("%s %s -> %d %s", request.method, request.url.path, exc.status_code, exc.message)
        return _error(exc.status_code, exc.code, exc.message)

    # --- OpenAI errors (most specific first for readability; matching is by class) ---
    @app.exception_handler(openai.RateLimitError)
    async def handle_rate_limit(request: Request, exc: openai.RateLimitError):
        if exc.code == "insufficient_quota":
            logger.error("OpenAI quota exhausted - check billing")
            return _error(503, "ai_unavailable", "The AI service is temporarily unavailable.")
        logger.warning("OpenAI rate limit on %s", request.url.path)
        retry_after = exc.response.headers.get("retry-after", "10")
        return _error(
            429, "rate_limited",
            "The AI service is busy. Please wait a few seconds and try again.",
            headers={"Retry-After": retry_after},
        )

    @app.exception_handler(openai.AuthenticationError)
    @app.exception_handler(openai.PermissionDeniedError)
    async def handle_auth(request: Request, exc: openai.APIStatusError):
        logger.error("OpenAI rejected the API key (%s) - check OPENAI_API_KEY in backend/.env",
                      exc.status_code)
        return _error(503, "ai_unavailable", "The AI service is not configured correctly.")

    @app.exception_handler(openai.APITimeoutError)
    async def handle_timeout(request: Request, exc: openai.APITimeoutError):
        logger.warning("OpenAI timed out on %s", request.url.path)
        return _error(504, "ai_timeout", "The AI service took too long to respond. Please try again.")

    @app.exception_handler(openai.APIConnectionError)
    async def handle_connection(request: Request, exc: openai.APIConnectionError):
        logger.warning("Could not reach OpenAI on %s: %s", request.url.path, exc)
        return _error(503, "ai_unreachable", "Can't reach AI service. Check the connection and try again.")

    @app.exception_handler(openai.BadRequestError)
    async def handle_bad_request(request: Request, exc: openai.BadRequestError):
        if exc.code == "context_length_exceeded":
            return _error(413, "text_too_long", "The text is too long to analyse. Please shorten it.")
        # Anything else means we use an invalid request to OpenAI: that is our bug.
        logger.exception("OpenAI rejected our request on %s", request.url.path)
        return _error(500, "internal_error", "Something went wrong on the server.")

    @app.exception_handler(openai.APIStatusError)
    async def handle_openai_status(request: Request, exc: openai.APIStatusError):
        logger.warning("OpenAI returned %s on %s", exc.status_code, request.url.path)
        return _error(502, "ai_error", "The AI service returned an error. Please try again.")


    # --- Everything else = a bug in our code --------------------------------------------
    @app.middleware("http")
    async def catch_unexpected_errors(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            return _error(500, "internal_error", "Something went wrong on the server.")
