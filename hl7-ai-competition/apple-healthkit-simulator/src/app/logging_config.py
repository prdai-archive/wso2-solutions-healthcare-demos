import logging
import sys

from loguru import logger

_UVICORN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access")


class InterceptHandler(logging.Handler):
    """Routes stdlib logging records (ours and uvicorn's) into loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def configure_logging(level: str) -> None:
    """Send every logger (ours and uvicorn's) through loguru, serialized as JSON."""
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in _UVICORN_LOGGERS:
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True

    logger.remove()
    logger.add(sys.stdout, level=level, serialize=True)
