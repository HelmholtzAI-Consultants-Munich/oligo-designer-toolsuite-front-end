"""Makes Oligo Designer Toolsuite messages safe to show users.

The toolsuite's error messages and warnings are shown as they are, except that the
server paths they name are reduced to file names.
"""

import logging
import re

#: A file system path: absolute, home-relative, or Windows. The lookbehind keeps this
#: off separators inside ordinary text ("A/C/G/T only", "0/1 values", "bit_1/bit_2").
PATH = re.compile(r"(?<![\w.~])(?:~|[A-Za-z]:)?[/\\][\w.+-]+(?:[/\\][\w.+-]+)*[/\\]?")

#: Longer messages are cut here, e.g. a tool that prints its whole usage text on failure.
MAX_MESSAGE_LENGTH = 600

ODT_LOGGER_NAME = "oligo_designer_toolsuite"

#: Enough to explain a run without turning the page into a log viewer.
MAX_COLLECTED_WARNINGS = 10


def _file_name(path: str) -> str:
    """Returns the last component of a path, for either separator."""
    return path.rstrip("/\\").rsplit("/", 1)[-1].rsplit("\\", 1)[-1] or "a directory"


def clean(message: str) -> str | None:
    """Returns the message with every path reduced to its file name and cut to length, or None if empty."""
    text = PATH.sub(lambda match: _file_name(match.group(0)), message).strip()
    if len(text) > MAX_MESSAGE_LENGTH:
        text = text[:MAX_MESSAGE_LENGTH].rstrip() + "…"
    return text or None


class UserWarningCollector(logging.Handler):
    """Collects the toolsuite's warnings while a run is inside `with`.

    Notes:
        WARNING only: the toolsuite logs every input path at INFO, and its one ERROR
        ("The oligo database is empty. Exiting program...") repeats the raised error.
        Relies on `disable_existing_loggers: False` in Config.get_logging_config.
    """

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.messages: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno != logging.WARNING or len(self.messages) >= MAX_COLLECTED_WARNINGS:
            return
        try:
            message = clean(record.getMessage())
        except Exception:  # Logging must never be the thing that breaks a run.
            return
        if message and message not in self.messages:
            self.messages.append(message)

    def __enter__(self) -> "UserWarningCollector":
        logging.getLogger(ODT_LOGGER_NAME).addHandler(self)
        return self

    def __exit__(self, *exc_info: object) -> None:
        logging.getLogger(ODT_LOGGER_NAME).removeHandler(self)
