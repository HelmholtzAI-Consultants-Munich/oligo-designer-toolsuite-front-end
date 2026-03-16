import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import Navbar from "../ui/Topbar";
import type { FileState, Status, Modal, RJSFFormData } from "../types";
import { handleSubmit } from "../helpers";
import FieldTemplate from "./FieldTemplate";
import { TabsLayout } from "./TabsLayout";
import FileSelection from "./FileSelection";
import { RunLinkModal } from "../modal/RunLinkModal";
import { InfoModal } from "../modal/InfoModal";
import Ajv2020 from "ajv/dist/2020";
import {
    Alert,
    Button,
    Container,
    Form as BootstrapForm,
} from "react-bootstrap";
import { useAuth } from "../../modules/useAuth";
import { Link } from "react-router";

type Props = {
    pipeline: string;
    title: string;
    schema: RJSFSchema;
    uiSchema: UiSchema;
};

const PipelineTemplate: React.FC<Props> = ({
    pipeline,
    title,
    schema,
    uiSchema,
}) => {
    const { legal, acceptTerms } = useAuth();
    const [formData, setFormData] = useState<RJSFFormData>({});
    const validator = customizeValidator({ AjvClass: Ajv2020 });

    const [files, setFiles] = useState<FileState>({
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    const [runId, setRunId] = useState<string | null>(null);
    const [runStatus, setRunStatus] = useState<Status>("idle");
    const [modal, setModal] = useState<Modal>({
        show: false,
        title: "",
        body: "",
    });
    const [showTermsAcceptance, setShowTermsAcceptance] = useState(false);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [termsError, setTermsError] = useState<string | null>(null);
    const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

    const closeModal = () => {
        setModal({ ...modal, show: false });
    };
    const widgets = {
        fileSelection: FileSelection,
    };

    const submitPipeline = async () => {
        await handleSubmit(
            runStatus,
            setRunStatus,
            setRunId,
            setModal,
            files,
            formData,
            pipeline
        );
    };

    const handleFormSubmit = async () => {
        if (legal?.requires_terms_acceptance) {
            if (!showTermsAcceptance) {
                setShowTermsAcceptance(true);
                setTermsError(null);
                return;
            }

            if (!hasAcceptedTerms) {
                setTermsError(
                    "You must accept the Terms of Service and acknowledge the Privacy Policy before continuing."
                );
                return;
            }

            setIsAcceptingTerms(true);
            setTermsError(null);
            const accepted = await acceptTerms();
            setIsAcceptingTerms(false);

            if (!accepted) {
                setTermsError(
                    "We couldn't record your acceptance. Please try again."
                );
                return;
            }

            setShowTermsAcceptance(true);
            setHasAcceptedTerms(false);
        }

        await submitPipeline();
    };

    return (
        <>
            <Navbar />
            {runId ? (
                <RunLinkModal
                    show={modal.show}
                    close={closeModal}
                    title={modal.title}
                    body={modal.body}
                    runId={runId}
                />
            ) : (
                <InfoModal
                    show={modal.show}
                    close={closeModal}
                    title={modal.title}
                    body={modal.body}
                />
            )}
            <Container>
                <h2>{title}</h2>
                <Form
                    schema={schema}
                    uiSchema={uiSchema}
                    formContext={{
                        files,
                        setFiles,
                    }}
                    formData={formData}
                    templates={{
                        FieldTemplate: FieldTemplate,
                        ObjectFieldTemplate: TabsLayout,
                    }}
                    widgets={widgets}
                    validator={validator}
                    onChange={(e) => setFormData(e.formData)}
                    onSubmit={handleFormSubmit}
                >
                    <div className="mt-4">
                        <Button
                            type="submit"
                            disabled={runStatus !== "idle" || isAcceptingTerms}
                        >
                            {isAcceptingTerms
                                ? "Saving..."
                                : runStatus === "idle"
                                  ? "Submit"
                                  : "Submitting..."}
                        </Button>
                        {showTermsAcceptance &&
                            legal?.requires_terms_acceptance && (
                                <div className="border rounded p-3 mt-3 bg-light">
                                    <p className="mb-2">
                                        Before running this pipeline, please
                                        accept the{" "}
                                        <Link to="/terms">
                                            Terms of Service
                                        </Link>{" "}
                                        and review the{" "}
                                        <Link to="/privacy-policy">
                                            Privacy Policy
                                        </Link>
                                        .
                                    </p>
                                    {termsError && (
                                        <Alert
                                            variant="danger"
                                            className="mb-3"
                                        >
                                            {termsError}
                                        </Alert>
                                    )}
                                    <BootstrapForm.Check
                                        id={`${pipeline}-terms-acceptance`}
                                        type="checkbox"
                                        className="mb-3"
                                        checked={hasAcceptedTerms}
                                        onChange={(event) =>
                                            setHasAcceptedTerms(
                                                event.target.checked
                                            )
                                        }
                                        label="I accept the Terms of Service and acknowledge the Privacy Policy."
                                    />
                                    <div className="text-muted small">
                                        Check the box above, then press Submit
                                        again.
                                    </div>
                                </div>
                            )}
                    </div>
                </Form>
            </Container>
        </>
    );
};

export default PipelineTemplate;
