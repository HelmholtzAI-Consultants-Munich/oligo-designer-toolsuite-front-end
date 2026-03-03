export const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const parsedFeedbackMaxLength = Number.parseInt(
    import.meta.env.VITE_FEEDBACK_MAX_LENGTH || "2000",
    10
);

export const FEEDBACK_MAX_LENGTH =
    Number.isFinite(parsedFeedbackMaxLength) && parsedFeedbackMaxLength > 0
        ? parsedFeedbackMaxLength
        : 2000;
