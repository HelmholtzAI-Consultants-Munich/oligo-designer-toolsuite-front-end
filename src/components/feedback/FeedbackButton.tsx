import React, { useState } from "react";
import axios from "axios";
import { Button, Modal, Form, Alert } from "react-bootstrap";
import { ChatDotsFill } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";

interface FeedbackButtonProps {
    context?: Record<string, unknown>;
    size?: "sm" | "md";
    variant?: "outline-primary" | "primary" | "light";
    /** When true, renders as a fixed floating action button (bottom-right) */
    floating?: boolean;
}

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
    const [success, setSuccess] = useState<string | null>(null);

    const open = () => {
        setShow(true);
        setError(null);
        setSuccess(null);
    };

    const close = () => {
        setShow(false);
        setMessage("");
        setError(null);
        setSuccess(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            setError("Please enter your feedback before submitting.");
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const metadata = {
                ...(context || {}),
                path: window.location.pathname,
            };

            await axios.post(
                BACKEND_URL + "/api/feedbacks",
                { message, metadata },
                { withCredentials: true }
            );

            setSuccess("Thank you for your feedback!");
            setMessage("");
            // Auto-close after a short delay
            setTimeout(() => {
                close();
            }, 1200);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(
                    err.response?.data?.error ||
                        err.message ||
                        "Failed to submit feedback"
                );
            } else {
                setError("Failed to submit feedback");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const buttonSizeClass = size === "sm" ? "btn-sm" : "";

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

            <Modal show={show} onHide={close} centered>
                <Form onSubmit={handleSubmit}>
                    <Modal.Header closeButton>
                        <Modal.Title>Share Your Feedback</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p className="mb-3 text-muted">
                            Tell us what works well, what’s confusing, or what
                            you&apos;d like to see improved for this page or
                            pipeline.
                        </p>
                        {error && (
                            <Alert variant="danger" className="py-2">
                                {error}
                            </Alert>
                        )}
                        {success && (
                            <Alert variant="success" className="py-2">
                                {success}
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
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="secondary"
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
