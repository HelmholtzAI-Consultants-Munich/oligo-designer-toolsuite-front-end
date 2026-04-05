export const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export const FEEDBACK_MAX_LENGTH =
    Number(import.meta.env.VITE_FEEDBACK_MAX_LENGTH) || 2000;
