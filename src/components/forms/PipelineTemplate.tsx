import { useRef, useState, useEffect, useCallback } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import type { FileState, RJSFFormData } from "../componentTypes";
import { addComments, handleSubmit } from "../fastaGenerateForm/helpers";
import FieldTemplate from "./FieldTemplate";
import { TabsLayout } from "./TabsLayout";
import Ajv2020 from "ajv/dist/2020";
import Page from "../ui/Page";
import { formatDateTime } from "../ui/utils";
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
    type ImportResult,
} from "./pipelineConfigIO";
import { useRuns } from "../../hooks/useRuns";
import { Button } from "react-bootstrap";
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
import { useLocation } from "react-router";

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
    const location = useLocation();
    const configApplied = useRef(false);

    const applyValidatedConfig = useCallback(
        (
            result: Extract<ImportResult, { ok: true }>,
            importedConfig: unknown,
            successTitle: string
        ) => {
            setFormData((prev) => ({ ...prev, ...result.config }));
            setFastaForms(convertImportedFastaForms(result.fastaForms));
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
        [setFormData, setFastaForms]
    );

    // Apply a config that was passed via navigation location state (e.g. "Use Settings" in Runs page).
    // This mirrors the existing file-import flow exactly.
    useEffect(() => {
        if (configApplied.current) return;
        const importedConfig = location.state?.importedConfig;
        if (!importedConfig) return;

        configApplied.current = true;
        // Clear the state so re-renders don't re-apply the config
        window.history.replaceState(
            { ...window.history.state, importedConfig: undefined },
            ""
        );

        const result = importAndValidate(importedConfig, schema, pipeline);
        if (!result.ok) {
            showToast({
                title: "Load Config Failed",
                content: result.error,
                type: "danger",
            });
            return;
        }
        applyValidatedConfig(result, importedConfig, "Config Loaded");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const widgets = {
        fileSelection: GenomicInput,
    };

    const tabs = uiSchema?.["ui:tabs"] as TabConfig[] | undefined;

    const importInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () =>
        triggerDownload(
            buildExportPayload(formData, pipeline, schema, fastaForms)
        );

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
            applyValidatedConfig(result, parsed, "Import Successful");
        };
        reader.readAsText(file);
    };

    const runPipeline = () => {
        const uiConfig = buildExportPayload(
            formData,
            pipeline,
            schema,
            fastaForms
        );
        handleSubmit(
            files,
            fastaForms,
            formData,
            pipeline,
            updateRuns,
            uiConfig
        );
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
                onSubmit={runPipeline}
            >
                <Button type="submit" variant="primary">
                    Run Pipeline <Send className="ms-2" />
                </Button>
            </Form>
        </Page>
    );
};

export default PipelineTemplate;
