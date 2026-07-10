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

import type { RJSFFormData } from "../componentTypes";
import { showModal } from "../../utils/modalUtil";
import FieldTemplate from "./FieldTemplate";
import Ajv2020 from "ajv/dist/2020";
import Page from "../ui/Page";
import { formatDateTime } from "../ui/utils";
import { BoxArrowInDown, Send } from "react-bootstrap-icons";
import { importAndValidate } from "./pipelineConfigIO";

import { Button } from "react-bootstrap";
import { useLocation } from "react-router";
import { FileInput, GenomicInput } from "./GenomicInput";
import { showToast } from "../../utils/toastUtil";
import type { Pipeline } from "../../pipelineConfig/config";
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
import RunConfirmationModal from "./RunConfirmationModal";

type Props = {
    pipeline: Pipeline["name"];
    title: string;
    schema: RJSFSchema;
    uiSchema: UiSchema;
};

/**
 * Renders a form for a specific pipeline, allowing users to input data and run the pipeline.
 * @param pipeline - The name of the pipeline for which the form is being rendered.
 * @param title - The title to be displayed on the page.
 * @param schema - The JSON schema defining the structure and validation rules for the form data.
 * @param uiSchema - The UI schema defining how the form fields should be rendered.
 * @returns A React component that renders the pipeline form and handles user interactions, including form submission, validation, and displaying modals for confirmation.
 */

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

    const location = useLocation();

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

    const handleImport = () => importInputRef.current?.click();

    const preventSubmitOnEnter = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "Enter") return;

            const target = event.target;
            if (
                target instanceof HTMLTextAreaElement ||
                (target instanceof HTMLElement && target.isContentEditable)
            ) {
                return;
            }

            event.preventDefault();
        },
        []
    );

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

    const runPipeline = async () => {
        submitButtonRef.current?.click();
    };

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

    const showRunConfirmationModal = () => {
        showModal({
            rawContent: (
                <RunConfirmationModal
                    formData={formData}
                    pipeline={pipeline}
                    schema={schema}
                    setSubmissionTried={setSubmissionTried}
                />
            ),
            centered: true,
            ignoreBackdropClick: true,
            dialogClassName: "modal-wide",
        });
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
            <div onKeyDown={preventSubmitOnEnter}>
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
                    onSubmit={showRunConfirmationModal}
                    onError={handlePipelineSubmitError}
                >
                    <Button
                        ref={submitButtonRef}
                        type="submit"
                        variant="primary"
                    >
                        <>
                            Run Pipeline <Send className="ms-2" />
                        </>
                    </Button>
                </Form>
            </div>
        </Page>
    );
};

export default PipelineTemplate;
