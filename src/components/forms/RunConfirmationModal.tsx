import Modal from "react-bootstrap/Modal";
import type { RJSFSchema } from "@rjsf/utils";
import { closeModal } from "../../utils/modalUtil";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import { useRef, useState } from "react";
import { Send } from "react-bootstrap-icons";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Alert, Button, Form } from "react-bootstrap";
import { TURNSTILE_SITE_KEY } from "../../config";
import { useRuns } from "../../hooks/useRuns";
import { showToast } from "../../utils/toastUtil";
import { buildExportPayload } from "./pipelineConfigIO";
import type { RJSFFormData } from "../componentTypes";
import { handleSubmit } from "../fastaGenerateForm/helpers";

type RunConfirmationModalProps = {
    pipeline: string;
    schema: RJSFSchema;
    formData: RJSFFormData;
    setSubmissionTried: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * Renders a modal for confirming the submission of a pipeline run.
 * @param pipeline - The name of the pipeline being run.
 * @param schema - The JSON schema defining the structure and validation rules for the form data.
 * @param formData - The data from the form to be submitted.
 * @param setSubmissionTried - A function to update the state indicating whether a submission has been attempted.
 * @returns
 */

const RunConfirmationModal: React.FC<RunConfirmationModalProps> = ({
    pipeline,
    schema,
    formData,
    setSubmissionTried,
}) => {
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

    const [run_name, setRunName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const turnstileRef = useRef<TurnstileInstance | null>(null);
    const sitekey = TURNSTILE_SITE_KEY;

    const { updateRuns } = useRuns();
    const navigate = useNavigate();

    const auth = useAuth();
    const { acceptTerms } = auth;

    const requiresTermsAcceptance =
        auth.legal?.accepted_terms_version !==
        auth.legal?.current_terms_version;

    /**
     * Handles the acceptance of terms and conditions.
     * @returns A promise resolving to a boolean indicating whether the terms were accepted.
     */
    const handleTermsAcceptance = async () => {
        if (requiresTermsAcceptance) {
            if (!hasAcceptedTerms) {
                showToast({
                    title: "Terms acceptance required",
                    content:
                        "You must accept the Terms of Service and acknowledge the Privacy Policy before continuing.",
                    type: "danger",
                });
                const acceptanceElement =
                    document.getElementById("terms-acceptance");
                acceptanceElement?.scrollIntoView({ behavior: "smooth" });
                return;
            }
            setIsAcceptingTerms(true);
            const accepted = await acceptTerms();
            setIsAcceptingTerms(false);
            if (!accepted) {
                showToast({
                    title: "Terms acceptance failed",
                    content:
                        "We couldn't record your acceptance. Please try again.",
                    type: "danger",
                });
                return;
            }
            setHasAcceptedTerms(false);
        }
    };
    /**
     * Handles the validation of the run name.
     * @returns A boolean indicating whether the run name is valid.
     */
    const handleRunName = () => {
        const trimmedMessage = run_name.trim();

        if (trimmedMessage.length === 0) {
            setError("Please enter a name for your run.");
            return false;
        }
        if (trimmedMessage.length > 20) {
            setError(`Run name is too long, (max ${20} characters).`);
            return false;
        }

        setError(null);
        return true;
    };
    /**
     * Handles the submission of the pipeline run.
     * @returns A promise resolving to a boolean indicating whether the submission was successful.
     */
    const handlePipelineSubmit = async () => {
        if (error) {
            return;
        }

        const submittedFormData = formData as RJSFFormData;

        await handleTermsAcceptance();
        if (!handleRunName()) {
            return;
        }

        const pipelineRunConfig = buildExportPayload(
            submittedFormData,
            pipeline,
            schema
        );
        handleSubmit(
            submittedFormData,
            pipeline,
            run_name,
            updateRuns,
            turnstileRef.current?.getResponse() ?? "",
            navigate,
            pipelineRunConfig
        );
        closeModal();
        turnstileRef.current?.reset();
        setSubmissionTried(true);
    };

    return (
        <>
            <Modal.Header closeButton>
                <Modal.Title>Confirm Run Submission</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group controlId="runName">
                    <Form.Label>Please enter a name for your run:</Form.Label>
                    <Form.Control
                        value={run_name}
                        onChange={(e) => {
                            setRunName(e.target.value);
                            if (error) {
                                setError(null);
                            }
                        }}
                        placeholder=""
                        maxLength={20}
                        autoFocus
                    />
                    <div className="text-muted small mt-1 text-end">
                        {run_name.length}/{20}
                    </div>
                    {error && (
                        <Alert variant="danger" className="py-2">
                            {error}
                        </Alert>
                    )}
                </Form.Group>{" "}
                {requiresTermsAcceptance && (
                    <div
                        className="border rounded p-3 mb-3 bg-light"
                        id="terms-acceptance"
                    >
                        <p className="mb-2">
                            Before running this pipeline, please accept the{" "}
                            <Link target="_blank" to="/terms">
                                Terms of Service
                            </Link>{" "}
                            and review the{" "}
                            <Link target="_blank" to="/privacy-policy">
                                Privacy Policy
                            </Link>
                            .
                        </p>
                        <Form.Check
                            id={`${pipeline}-terms-acceptance`}
                            type="checkbox"
                            className="mb-3"
                            checked={hasAcceptedTerms}
                            onChange={(e) =>
                                setHasAcceptedTerms(e.target.checked)
                            }
                            label="I accept the Terms of Service and acknowledge the Privacy Policy."
                        />
                    </div>
                )}
                <Turnstile
                    ref={turnstileRef}
                    className="pipeline-turnstile"
                    siteKey={sitekey}
                    options={{
                        theme: "light",
                        language: "en",
                    }}
                />
            </Modal.Body>

            <Modal.Footer>
                {" "}
                <Button variant="outline-border" onClick={closeModal}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={isAcceptingTerms || Boolean(error)}
                    onClick={handlePipelineSubmit}
                >
                    {isAcceptingTerms ? (
                        "Saving..."
                    ) : (
                        <>
                            Run Pipeline <Send className="ms-2" />
                        </>
                    )}
                </Button>
            </Modal.Footer>
        </>
    );
};

export default RunConfirmationModal;
