import {
    useRef,
    useState,
    useEffect,
    useCallback,
    useEffectEvent,
    useMemo,
} from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import { Turnstile } from "@marsidev/react-turnstile";
import type { RJSFFormData } from "../componentTypes";
import { handleSubmit } from "../fastaGenerateForm/helpers";
import FieldTemplate from "./FieldTemplate";
import Ajv2020 from "ajv/dist/2020";
import Page from "../ui/Page";
import { formatDateTime } from "../ui/utils";
import { BoxArrowInDown, BoxArrowUp, Send } from "react-bootstrap-icons";
import {
    buildExportPayload,
    triggerDownload,
    importAndValidate,
} from "./pipelineConfigIO";
import { useRuns } from "../../hooks/useRuns";
import { useAuth } from "../../hooks/useAuth";
import { Button, Form as BootstrapForm } from "react-bootstrap";
import { Link, useLocation } from "react-router";
import { FileInput, GenomicInput } from "../fastaGenerateForm/GenomicInput";
import { showToast } from "../../utils/toastUtil";
import type { Pipeline } from "../../pipelineConfig/config";
import { TURNSTILE_SITE_KEY } from "../../config";
import { excludeHiddenTabs, snakeCaseToTitleCase } from "./utils";
import ObjectFieldTemplate from "./ObjectFieldTemplate";
import WrappedBaseInputTemplate from "./BaseInputTemplate";
import {
    WrappedAnyOfField,
    WrappedOneOfField,
    MultiSchemaFieldTemplate,
} from "./MultiSchemaField";
import DescriptionFieldTemplate from "./DescriptionFieldTemplate";
import {
    ArrayFieldTemplate,
    ArrayFieldItemTemplate,
} from "./ArrayFieldTemplates";
import ErrorListTemplate from "./ErrorListTemplate";
import TxtUploadInput from "./TxtUploadInput";
import type { IChangeEvent } from "@rjsf/core";

type Props = {
    pipeline: Pipeline["name"];
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
    const [formData, setFormData] = useState<RJSFFormData>({});
    const [submissionTried, setSubmissionTried] = useState(false);
    const submitButtonRef = useRef<HTMLButtonElement | null>(null);
    const validator = useMemo(
        () =>
            customizeValidator({
                AjvClass: Ajv2020,
                // Enable this once ajv supports boolean discriminators
                // ajvOptionsOverrides: { discriminator: true }
            }),
        []
    );

    const { updateRuns } = useRuns();
    const auth = useAuth();
    const { acceptTerms } = auth;

    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

    const requiresTermsAcceptance =
        auth.legal?.accepted_terms_version !==
        auth.legal?.current_terms_version;

    const location = useLocation();

    const sitekey = TURNSTILE_SITE_KEY;

    const applyValidatedConfig = useCallback(
        (importedConfig: unknown, successTitle: string, errorTitle: string) => {
            const result = importAndValidate(importedConfig, schema, pipeline);
            if (!result.ok) {
                showToast({
                    title: errorTitle,
                    content: result.error,
                    type: "danger",
                });
                return;
            }
            setFormData(result.config);
            const exportedAt = (
                importedConfig as { _meta?: { exportedAt?: string } }
            )._meta?.exportedAt;
            const dateStr = exportedAt ? formatDateTime(exportedAt) : undefined;
            const skipNote =
                result.skippedFields.length > 0
                    ? ` Fields not in current schema were skipped: ${result.skippedFields.join(", ")}.`
                    : "";
            const datePart = dateStr ? ` from ${dateStr}` : "";
            showToast({
                title: successTitle,
                content: `Configuration${datePart} loaded.${skipNote}`,
                type: "success",
            });
        },
        [schema, pipeline]
    );
    const applyValidatedConfigEvent = useEffectEvent(applyValidatedConfig);

    useEffect(() => {
        const importedConfig = location.state?.importedConfig;
        if (!importedConfig) return;
        applyValidatedConfigEvent(
            importedConfig,
            "Config Loaded",
            "Load Config Failed"
        );
    }, [location.state]);

    const fields = {
        genomicInput: GenomicInput,
        fileUpload: FileInput,
        AnyOfField: WrappedAnyOfField,
        OneOfField: WrappedOneOfField,
        txtUploadInput: TxtUploadInput,
    };

    const tabs = useMemo(() => {
        return schema.properties
            ? excludeHiddenTabs(Object.keys(schema.properties))
            : undefined;
    }, [schema.properties]);

    const importInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () =>
        triggerDownload(buildExportPayload(formData, pipeline, schema));

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
            applyValidatedConfig(parsed, "Import Successful", "Import Failed");
        };
        reader.readAsText(file);
    };

    const [token, setToken] = useState<string | null>(null);

    const runPipeline = async () => {
        submitButtonRef.current?.click();
    };

    const handlePipelineSubmit = useCallback(
        async (data: IChangeEvent<RJSFFormData>) => {
            const submittedFormData = (data.formData ??
                formData) as RJSFFormData;
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

            const pipelineRunConfig = buildExportPayload(
                submittedFormData,
                pipeline,
                schema
            );
            handleSubmit(
                submittedFormData,
                pipeline,
                updateRuns,
                token,
                pipelineRunConfig
            );
            setSubmissionTried(true);
        },
        [
            formData,
            pipeline,
            schema,
            updateRuns,
            token,
            requiresTermsAcceptance,
            hasAcceptedTerms,
            acceptTerms,
        ]
    );

    const handlePipelineSubmitError = () => {
        const errorElement = document.getElementById("rjsf-error-list");
        if (errorElement) {
            errorElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
        setSubmissionTried(true);
    };

    return (
        <Page
            title={title}
            tabs={tabs?.map((key) => ({
                label: snakeCaseToTitleCase(key),
                tabKey: key,
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
                    onClick: () => void runPipeline(),
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
                formData={formData}
                experimental_defaultFormStateBehavior={{
                    arrayMinItems: {
                        populate: "never",
                    },
                }}
                showErrorList={"bottom"}
                templates={{
                    FieldTemplate,
                    BaseInputTemplate: WrappedBaseInputTemplate,
                    ObjectFieldTemplate,
                    MultiSchemaFieldTemplate,
                    ArrayFieldTemplate,
                    ArrayFieldItemTemplate,
                    DescriptionFieldTemplate,
                    ErrorListTemplate,
                }}
                fields={fields}
                validator={validator}
                liveValidate={submissionTried ? "onChange" : false}
                onChange={(e) => setFormData(e.formData)}
                onSubmit={handlePipelineSubmit}
                onError={handlePipelineSubmitError}
            >
                <Turnstile
                    siteKey={sitekey}
                    options={{
                        theme: "light",
                        language: "en",
                    }}
                    onSuccess={setToken}
                />
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
                    ref={submitButtonRef}
                    type="submit"
                    variant="primary"
                    disabled={isAcceptingTerms}
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
