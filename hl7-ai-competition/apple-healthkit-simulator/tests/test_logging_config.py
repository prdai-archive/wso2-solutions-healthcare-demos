import json
import logging
import sys

from app.logging_config import JsonFormatter


def test_json_formatter_renders_message_as_json() -> None:
    record = logging.LogRecord(
        name="app", level=logging.INFO, pathname=__file__, lineno=1, msg="hello %s", args=("world",), exc_info=None
    )
    payload = json.loads(JsonFormatter().format(record))

    assert payload["level"] == "INFO"
    assert payload["logger"] == "app"
    assert payload["message"] == "hello world"
    assert "exception" not in payload


def test_json_formatter_includes_exception_traceback() -> None:
    try:
        message = "boom"
        raise ValueError(message)
    except ValueError:
        record = logging.LogRecord(
            name="app", level=logging.ERROR, pathname=__file__, lineno=1, msg="failed", args=None, exc_info=True
        )
        record.exc_info = sys.exc_info()

    payload = json.loads(JsonFormatter().format(record))
    assert "ValueError: boom" in payload["exception"]
