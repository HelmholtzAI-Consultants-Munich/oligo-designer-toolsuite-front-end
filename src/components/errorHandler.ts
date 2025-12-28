/**
 * Error Handler Utility for Extracting and Displaying User-Friendly Error Messages
 *
 * Extracts sanitized error messages from backend responses and provides
 * fallback messages for different error types. Never displays raw error objects.
 */

interface AxiosError {
    response?: {
        data?: {
            error?: string;
            error_message?: string;
            status?: string;
            message?: string;
        };
        status?: number;
    };
    message?: string;
}

/**
 * Extracts a user-friendly error message from an axios error response.
 *
 * Backend already sanitizes errors, so this function extracts the sanitized
 * message and provides appropriate fallbacks for network/server errors.
 *
 * @param error - The error object from axios catch block
 * @param errorType - Type of error: "submission" (immediate) or "run" (async)
 * @returns User-friendly error message string
 */
export function extractErrorMessage(
    error: unknown,
    errorType: "submission" | "run" = "submission"
): string {
    const axiosError = error as AxiosError;

    // Check if it's an axios error with response data
    if (axiosError.response?.data) {
        const data = axiosError.response.data;

        // Try to extract error message from different possible fields
        if (data.error) {
            return data.error;
        }
        if (data.error_message) {
            return data.error_message;
        }
        if (data.message) {
            return data.message;
        }

        // Handle HTTP status codes
        const status = axiosError.response.status;
        if (status === 400) {
            return "The information you provided is not valid. Please check your input and try again.";
        }
        if (status === 401 || status === 403) {
            return "You don't have permission to perform this action. Please sign in or contact support.";
        }
        if (status === 404) {
            return "The page or resource you're looking for doesn't exist.";
        }
        if (status === 500) {
            return "Something went wrong on our end. Please try again in a few moments.";
        }
        if (status >= 500) {
            return "Our servers are experiencing issues. Please try again later.";
        }
    }

    // Handle network errors
    if (!axiosError.response) {
        return "Unable to connect to our servers. Please check your internet connection and try again.";
    }

    // Fallback for unknown errors
    if (errorType === "submission") {
        return "We couldn't submit your pipeline. Please check your input and try again.";
    } else {
        return "Something went wrong while running the pipeline. Please try again.";
    }
}

/**
 * Extracts error message specifically for pipeline submission errors.
 */
export function extractSubmissionError(error: unknown): string {
    return extractErrorMessage(error, "submission");
}

/**
 * Extracts error message specifically for pipeline run errors.
 */
export function extractRunError(error: unknown): string {
    return extractErrorMessage(error, "run");
}
