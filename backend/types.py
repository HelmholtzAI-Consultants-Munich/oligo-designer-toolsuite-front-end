from enum import StrEnum, auto, unique


@unique
class RunStatus(StrEnum):
    STARTED = auto()
    SUCCESS = auto()
    FAILURE = auto()
    PENDING = auto()
    TIMEOUT = auto()
