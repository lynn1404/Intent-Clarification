"""Logs how long a function call takes, so a slow request can be traced to a specific agent."""

import functools
import inspect
import logging
import time

logger = logging.getLogger(__name__)


def log_timing(func):
    """Log '-> name started' and '<- name took N.NNs' around a sync or async call."""
    if inspect.iscoroutinefunction(func):

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            logger.info("-> %s started", func.__name__)
            try:
                return await func(*args, **kwargs)
            finally:
                logger.info("<- %s took %.2fs", func.__name__, time.perf_counter() - start)

        return async_wrapper

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        start = time.perf_counter()
        logger.info("-> %s started", func.__name__)
        try:
            return func(*args, **kwargs)
        finally:
            logger.info("<- %s took %.2fs", func.__name__, time.perf_counter() - start)

    return sync_wrapper
