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
import { Button } from "react-bootstrap";
import { FileInput, GenomicInput } from "../fastaGenerateForm/GenomicInput";
import { showToast } from "../../utils/toastUtil";
import type { Pipeline } from "../../pipelineConfig/config";
import { useLocation } from "react-router";
import { snakeCaseToTitleCase } from "./utils";
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
        () => customizeValidator({ 
            AjvClass: Ajv2020,
            // Enable this once ajv supports boolean discriminators
            // ajvOptionsOverrides: { discriminator: true }
        }),
        []
    );

    const { updateRuns } = useRuns();

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
            setFormData((prev) => ({ ...prev, ...result.config }));
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

    // Apply a config that was passed via navigation location state (e.g. "Use Settings" in Runs page).
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
        const hiddenTabs = uiSchema?.["ui:hiddenTabs"] as string[] | undefined;
        return schema.properties
            ? Object.keys(schema.properties).filter(
                  (key) => !hiddenTabs?.includes(key)
              )
            : undefined;
    }, [schema.properties, uiSchema]);

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

    const runPipeline = () => {
        submitButtonRef.current?.click();
    };

    const handlePipelineSubmit = useCallback(
        (data: IChangeEvent<RJSFFormData>) => {
            const submittedFormData = (data.formData ??
                formData) as RJSFFormData;
            const pipelineRunConfig = buildExportPayload(
                submittedFormData,
                pipeline,
                schema
            );
            handleSubmit(
                submittedFormData,
                pipeline,
                updateRuns,
                pipelineRunConfig
            );
            setSubmissionTried(true);
        },
        [formData, pipeline, schema, updateRuns]
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
                    onClick: runPipeline,
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
                <Button ref={submitButtonRef} type="submit" variant="primary">
                    Run Pipeline <Send className="ms-2" />
                </Button>
            </Form>
        </Page>
    );
};

export default PipelineTemplate;
