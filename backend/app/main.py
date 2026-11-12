import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.api.error_handling import register_exception_handlers
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Intent Clarification Gate API",
    description="Asks, at the start of each task, whether the user wants to learn through it or get the result directly.",
    version="1.0.0",
)

# Handlers BEFORE CORS: middleware added later wraps the earlier ones, so CORS stays
# the outermost layer and even the catch-all's 500 responses carry CORS headers.
register_exception_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,  # no cookies are used
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["Health"])
async def health_check():
    """Liveness check: the server is up. Does not call OpenAI."""
    return {"status": "ok"}
