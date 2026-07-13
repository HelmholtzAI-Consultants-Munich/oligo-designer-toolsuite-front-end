import React, { useRef, useState } from "react";
import axios from "axios";
import { getErrorMessage } from "../../utils/errorUtil";
import { Button, Modal, Form, Alert } from "react-bootstrap";
import { ChatDotsFill } from "react-bootstrap-icons";
import { Link } from "react-router";
import {
    BACKEND_URL,
    FEEDBACK_MAX_LENGTH,
    TURNSTILE_SITE_KEY,
} from "../../config";
import { showToast } from "../../utils/toastUtil";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

interface FeedbackButtonProps {
    context?: Record<string, unknown>;
    size?: "sm" | "md";
    variant?: "outline-primary" | "primary" | "light";
    floating?: boolean;
}
/**
 * Displays a feedback button that opens a modal for users to submit feedback.
 *
 * @param context - Optional context object to include in the feedback submission. This can contain any additional information you want to send along with the feedback.
 * @param size - Optional size of the button. Default is "sm".
 * @param variant - Optional variant of the button. Default is "outline-primary".
 * @param floating - Optional boolean to determine if the button should be rendered as a fixed floating action button in the bottom-right corner. Default is false.
 * @returns A React functional component that renders a feedback button.
 */
const FeedbackButton: React.FC<FeedbackButtonProps> = ({
    context,
    size = "sm",
    variant = "outline-primary",
    floating = false,
}) => {
    const [show, setShow] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const turnstileRef = useRef<TurnstileInstance | null>(null);

    const sitekey = TURNSTILE_SITE_KEY;

    const getRunIdFromPath = () => {
        const match = window.location.pathname.match(/^\/runs\/([^/]+)$/);
        return match ? match[1] : null;
    };

    const open = () => {
        setShow(true);
        setError(null);
    };

    const close = () => {
        setShow(false);
        setMessage("");
        setError(null);
    };
    /**
     * Handles the submission of feedback. It validates the input, sends the feedback to the backend, and manages the UI state accordingly.
     *
     * @param e - The form submission event.
     * @returns A promise that resolves when the feedback submission process is complete.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
            setError("Please enter your feedback before submitting.");
            return;
        }
        if (trimmedMessage.length > FEEDBACK_MAX_LENGTH) {
            setError(
                `Feedback is too long (max ${FEEDBACK_MAX_LENGTH} characters).`
            );
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const metadata: Record<string, unknown> = {
                ...(context || {}),
                path: window.location.pathname,
            };
            const runId = getRunIdFromPath();
            if (runId) {
                metadata.run_id = runId;
            }

            await axios.post(
                BACKEND_URL + "/api/feedback",
                {
                    message,
                    metadata,
                    token: turnstileRef.current?.getResponse() ?? "",
                },
                { withCredentials: true }
            );
            turnstileRef.current?.reset();

            showToast({
                title: "Thank you for your feedback!",
                content: "Your feedback has been submitted successfully.",
                type: "success",
            });
            setMessage("");
            close();
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to submit feedback"));
        } finally {
            setSubmitting(false);
        }
    };

    const buttonSizeClass = size === "sm" ? "btn-sm" : "";
    const isRunDetailPage = Boolean(getRunIdFromPath());

    const triggerButton = floating ? (
        <Button
            variant="primary"
            className="rounded-pill shadow d-inline-flex align-items-center gap-2 fw-semibold"
            onClick={open}
            title="Send feedback"
            aria-label="Send feedback"
            style={{
                position: "fixed",
                bottom: "1.5rem",
                right: "1.5rem",
                zIndex: 1050,
            }}
        >
            <ChatDotsFill size={16} className="flex-shrink-0" aria-hidden />
            <span className="lh-1 d-none d-sm-inline">Feedback</span>
        </Button>
    ) : (
        <Button
            variant={variant}
            className={`${buttonSizeClass} rounded-pill d-inline-flex align-items-center justify-content-center gap-2 shadow-sm fw-semibold`}
            onClick={open}
        >
            <ChatDotsFill size={16} className="flex-shrink-0" aria-hidden />
            <span className="lh-1">Give Feedback</span>
        </Button>
    );

    return (
        <>
            {triggerButton}

            <Modal show={show} onHide={close} centered size="lg">
                <Form onSubmit={handleSubmit}>
                    <Modal.Header closeButton>
                        <Modal.Title>Share Your Feedback</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {isRunDetailPage ? (
                            <p className="mb-3 text-muted">
                                Do you have feedback regarding the output of
                                this pipeline run?
                            </p>
                        ) : (
                            <p className="mb-3 text-muted">
                                Tell us what works well, what’s confusing, or
                                what you&apos;d like to see improved for this
                                page or pipeline.
                            </p>
                        )}
                        {error && (
                            <Alert variant="danger" className="py-2">
                                {error}
                            </Alert>
                        )}
                        <Form.Group controlId="generalFeedback">
                            <Form.Label>Your feedback</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={5}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Write anything you’d like us to know about your experience..."
                                disabled={submitting}
                                maxLength={FEEDBACK_MAX_LENGTH}
                            />
                            <div className="text-muted small mt-1 text-end">
                                {message.length}/{FEEDBACK_MAX_LENGTH}
                            </div>
                        </Form.Group>
                        <Turnstile
                            ref={turnstileRef}
                            siteKey={sitekey}
                            options={{
                                theme: "light",
                                language: "en",
                            }}
                        />
                        <p className="text-muted small mt-3 mb-0">
                            By submitting feedback, you acknowledge the{" "}
                            <Link target="_blank" to="/privacy-policy">
                                Privacy Policy
                            </Link>
                            .
                        </p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="outline-secondary"
                            onClick={close}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? "Sending..." : "Send Feedback"}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </>
    );
};

export default FeedbackButton;
