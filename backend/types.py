"""Shared file for custom types."""

from enum import StrEnum, auto, unique


@unique
class RunStatus(StrEnum):
    """Enum of states a pipeline run can be in.

    TODO: consistently rename "status" to "state" across the project
    """

    STARTED = auto()
    SUCCESS = auto()
    FAILURE = auto()
    PENDING = auto()
    TIMEOUT = auto()
