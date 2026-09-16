"""Shared file for custom exception classes."""


class ODTCloudError(Exception):
    """
    Base exception for ODT Cloud errors.

    Exceptions with this type will not be filtered by error handlers.
    Use this class for relaying error messages to users.

    Arguments:
        message {str} -- the message shown to the user.
        details {list[str] | None} -- extra lines that explain the run, such as the
            warnings the toolsuite logged before it failed. Already checked as safe
            to show.
    """

    def __init__(self, message: str, details: list[str] | None = None):
        # Both go into args because Celery serializes an exception as its args and
        # rebuilds it with them. An attribute set outside args is lost on the way to
        # the errback, which is where the run document is written.
        super().__init__(message, details or [])
        self.details = details or []

    def __str__(self) -> str:
        """Returns the message alone, so callers never render the details tuple."""
        return self.args[0]


class ODTPipelineError(ODTCloudError):
    """
    Raised when the Oligo Designer Toolsuite pipeline execution fails.
    """


class ODTEmptyResultError(ODTCloudError):
    """
    Raised when the Oligo Designer Toolsuite pipeline execution results in an empty output.
    """
