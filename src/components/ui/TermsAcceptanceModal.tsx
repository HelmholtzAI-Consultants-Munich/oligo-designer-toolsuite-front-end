import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { Link } from "react-router";

import { useAuth } from "../../modules/useAuth";

const TermsAcceptanceModal: React.FC = () => {
    const { legal, termsPromptOpen, acceptTerms, closeTermsPrompt } = useAuth();
    const [hasAccepted, setHasAccepted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setHasAccepted(false);
        setError(null);
        closeTermsPrompt();
    };

    const handleAccept = async () => {
        if (!hasAccepted) {
            setError(
                "You must confirm acceptance of the Terms of Service and Privacy Policy to continue."
            );
            return;
        }

        setIsSubmitting(true);
        setError(null);
        const accepted = await acceptTerms();
        setIsSubmitting(false);

        if (!accepted) {
            setError("We couldn't record your acceptance. Please try again.");
            return;
        }

        setHasAccepted(false);
    };

    if (!legal) {
        return null;
    }

    return (
        <Modal show={termsPromptOpen} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Accept Terms to Continue</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    {legal.scope === "user"
                        ? "Before continuing with your account, please accept the current Terms of Service."
                        : "Before running pipelines or services in this session, please accept the current Terms of Service."}
                </p>
                <p className="text-muted small mb-3">
                    This acceptance also acknowledges the{" "}
                    <Link to="/privacy-policy">Privacy Policy</Link>. You can
                    review the full text here:{" "}
                    <Link to="/terms">Terms of Service</Link> and{" "}
                    <Link to="/privacy-policy">Privacy Policy</Link>.
                </p>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form.Check
                    id="terms-acceptance-checkbox"
                    type="checkbox"
                    checked={hasAccepted}
                    onChange={(event) => setHasAccepted(event.target.checked)}
                    label="I have read and accept the Terms of Service and acknowledge the Privacy Policy."
                />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={handleClose}>
                    Not Now
                </Button>
                <Button
                    variant="primary"
                    onClick={handleAccept}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Saving..." : "Accept and Continue"}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default TermsAcceptanceModal;
