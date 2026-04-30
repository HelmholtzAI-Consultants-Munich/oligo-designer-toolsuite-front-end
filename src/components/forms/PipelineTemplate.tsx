import { useRef, useState } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import type { FileState, RJSFFormData } from "../componentTypes";
import { addComments, handleSubmit } from "../fastaGenerateForm/helpers";
import FieldTemplate from "./FieldTemplate";
import { TabsLayout } from "./TabsLayout";
import Ajv2020 from "ajv/dist/2020";
import Page from "../ui/Page";
import {
    BoxArrowInDown,
    BoxArrowUp,
    CodeSlash,
    Send,
} from "react-bootstrap-icons";
import {
    buildExportPayload,
    triggerDownload,
    importAndValidate,
} from "./pipelineConfigIO";
import { useRuns } from "../../hooks/useRuns";
import { useAuth } from "../../hooks/useAuth";
import { Button, Form as BootstrapForm } from "react-bootstrap";
import { Link } from "react-router";
import type {
    FastaForm,
    FastaFormState,
    FastaFormStateUncommented,
    NestedObject,
} from "../fastaGenerateForm/types";
import GenomicInput from "../fastaGenerateForm/GenomicInput";
import { showToast } from "../../utils/toastUtil";
import genomicEnsForm from "./schemas/genomicEnsForm";
import genomicNcbiForm from "./schemas/genomicNcbiForm";

type Props = {
    pipeline: string;
    title: string;
    schema: RJSFSchema;
    uiSchema: UiSchema;
};

interface TabConfig {
    title: string;
    fields: Array<string | string[]>;
}

const convertImportedFastaForms = (
    importedFastaForms: FastaFormStateUncommented
): FastaFormState => {
    const convertForm = (
        form: FastaFormStateUncommented[keyof FastaFormStateUncommented][number]
    ): FastaForm => ({
        selectedSource: form.selectedSource,
        formDataNcbi: addComments(
            form.formDataNcbi as unknown as NestedObject,
            genomicNcbiForm as unknown as NestedObject
        ) as unknown as FastaForm["formDataNcbi"],
        formDataEns: addComments(
            form.formDataEns as unknown as NestedObject,
            genomicEnsForm as unknown as NestedObject
        ) as unknown as FastaForm["formDataEns"],
    });

    return {
        files_fasta_target_probe_database:
            importedFastaForms.files_fasta_target_probe_database.map(
                convertForm
            ),
        files_fasta_reference_database_target_probe:
            importedFastaForms.files_fasta_reference_database_target_probe.map(
                convertForm
            ),
        files_fasta_reference_database_readout_probe:
            importedFastaForms.files_fasta_reference_database_readout_probe.map(
                convertForm
            ),
        files_fasta_reference_database_primer:
            importedFastaForms.files_fasta_reference_database_primer.map(
                convertForm
            ),
    };
};

const PipelineTemplate: React.FC<Props> = ({
    pipeline,
    title,
    schema,
    uiSchema,
}) => {
    const [formData, setFormData] = useState<RJSFFormData>({});
    const validator = customizeValidator({ AjvClass: Ajv2020 });

    const [fastaForms, setFastaForms] = useState<FastaFormState>({
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    const [files, setFiles] = useState<FileState>({
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    const { updateRuns } = useRuns();
    const auth = useAuth();
    const { acceptTerms } = auth;

    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

    const requiresTermsAcceptance =
        auth.legal?.accepted_terms_version !==
        auth.legal?.current_terms_version;

    const widgets = {
        fileSelection: GenomicInput,
    };

    const tabs = uiSchema?.["ui:tabs"] as TabConfig[] | undefined;

    const importInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () =>
        triggerDownload(
            buildExportPayload(formData, pipeline, schema, fastaForms)
        );

    const handleRunPipeline = async () => {
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
        handleSubmit(files, fastaForms, formData, pipeline, updateRuns);
    };

    const handleImport = () => importInputRef.current?.click();

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = (ev) => {
            let parsed: unknown;
            try {
                parsed = JSON.parse(ev.target?.result as string);
            } catch {
                showToast({
                    title: "Import Failed",
                    content: "The file is not valid JSON.",
                    type: "danger",
                });
                return;
            }
            const result = importAndValidate(parsed, schema, pipeline);
            if (!result.ok) {
                showToast({
                    title: "Import Failed",
                    content: result.error,
                    type: "danger",
                });
                return;
            }
            setFormData((prev) => ({
                ...prev,
                ...result.config,
            }));
            setFastaForms(convertImportedFastaForms(result.fastaForms));
            const skipNote =
                result.skippedFields.length > 0
                    ? ` Fields not in current schema were skipped: ${result.skippedFields.join(", ")}.`
                    : "";
            showToast({
                title: "Import Successful",
                content: `Configuration loaded.${skipNote}`,
                type: "success",
            });
        };
        reader.readAsText(file);
    };

    return (
        <Page
            title={title}
            tabs={tabs?.map((tab) => ({
                label: tab.title,
                tabKey: tab.title,
                icon:
                    tab.title === "Developer Settings" ? CodeSlash : undefined,
            }))}
            actions={[
                {
                    type: "button",
                    label: "Import Settings",
                    icon: BoxArrowInDown,
                    variant: "outline-border",
                    onClick: handleImport,
                },
                {
                    type: "button",
                    label: "Export Settings",
                    icon: BoxArrowUp,
                    variant: "outline-border",
                    onClick: handleExport,
                },
                {
                    type: "button",
                    label: "Run Pipeline",
                    icon: Send,
                    variant: "primary",
                    onClick: () => void handleRunPipeline(),
                },
            ]}
            stickyHeader
        >
            <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="visually-hidden"
                onChange={handleImportFile}
            />
            <Form
                schema={schema}
                uiSchema={uiSchema}
                formContext={{
                    files,
                    setFiles,
                    fastaForms,
                    setFastaForms,
                }}
                formData={formData}
                templates={{
                    FieldTemplate: FieldTemplate,
                    ObjectFieldTemplate: TabsLayout,
                }}
                widgets={widgets}
                validator={validator}
                onChange={(e) => setFormData(e.formData)}
                onSubmit={() => void handleRunPipeline()}
            >
                {requiresTermsAcceptance && (
                    <div
                        className="border rounded p-3 mt-5 bg-light"
                        id="terms-acceptance"
                    >
                        <p className="mb-2">
                            Before running this pipeline, please accept the{" "}
                            <Link to="/terms">Terms of Service</Link> and review
                            the <Link to="/privacy-policy">Privacy Policy</Link>
                            .
                        </p>
                        <BootstrapForm.Check
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
                <Button
                    type="submit"
                    variant="primary"
                    disabled={isAcceptingTerms}
                    className={requiresTermsAcceptance ? "mt-3" : "mt-5"}
                >
                    {isAcceptingTerms ? (
                        "Saving..."
                    ) : (
                        <>
                            Run Pipeline <Send className="ms-2" />
                        </>
                    )}
                </Button>
            </Form>
        </Page>
    );
};

export default PipelineTemplate;
