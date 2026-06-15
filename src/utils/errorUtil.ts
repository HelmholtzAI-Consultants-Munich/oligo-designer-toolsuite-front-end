import axios from "axios";

interface ErrorResponseData {
    error?: string;
}

export const getErrorMessage = (error: unknown, fallback: string): string => {
    if (!axios.isAxiosError<ErrorResponseData>(error)) {
        return fallback;
    }

    return error.response?.data?.error || error.message || fallback;
};
