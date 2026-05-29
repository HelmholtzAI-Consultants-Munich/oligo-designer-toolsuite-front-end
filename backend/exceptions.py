"""Shared file for custom exception classes."""


class ODTCloudError(Exception):
    """
    Base exception for ODT Cloud errors.

    Exceptions with this type will not be filtered by error handlers.
    Use this class for relaying error messages to users.
    """


class ODTPipelineError(ODTCloudError):
    """
    Raised when the Oligo Designer Toolsuite pipeline execution fails.
    """


class ODTEmptyResultError(ODTCloudError):
    """
    Raised when the Oligo Designer Toolsuite pipeline execution results in an empty output.
    """
