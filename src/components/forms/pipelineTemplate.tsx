import { useState, useRef } from "react";
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
import { Container, Button, Stack } from "react-bootstrap";
import { BoxArrowDown, BoxArrowInUp } from "react-bootstrap-icons";
import {
    buildExportPayload,
    triggerDownload,
    importAndValidate,
} from "./pipelineConfigIO";

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
    const closeModal = () => {
        setModal({ ...modal, show: false });
    };

    const importInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () =>
        triggerDownload(buildExportPayload(formData, pipeline, schema));

    const handleImportClick = () => importInputRef.current?.click();

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
                setModal({
                    show: true,
                    title: "Import Failed",
                    body: "The file is not valid JSON.",
                });
                return;
            }
            const result = importAndValidate(parsed, schema);
            if (!result.ok) {
                setModal({
                    show: true,
                    title: "Import Failed",
                    body: result.error,
                });
                return;
            }
            setFormData((prev) => ({ ...prev, ...result.config }));
            const skipNote =
                result.skippedFields.length > 0
                    ? ` Fields not in current schema were skipped: ${result.skippedFields.join(", ")}.`
                    : "";
            setModal({
                show: true,
                title: "Import Successful",
                body: `Configuration loaded.${skipNote}`,
            });
        };
        reader.readAsText(file);
    };

    const widgets = {
        fileSelection: FileSelection,
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
                <Stack direction="horizontal" gap={2} className="mb-3">
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleExport}
                    >
                        <BoxArrowDown className="me-1" aria-hidden />
                        Export Config
                    </Button>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleImportClick}
                    >
                        <BoxArrowInUp className="me-1" aria-hidden />
                        Import Config
                    </Button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".json,application/json"
                        style={{ display: "none" }}
                        onChange={handleImportFile}
                    />
                </Stack>
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
                    onSubmit={() =>
                        handleSubmit(
                            runStatus,
                            setRunStatus,
                            setRunId,
                            setModal,
                            files,
                            formData,
                            pipeline
                        )
                    }
                />
            </Container>
        </>
    );
};

export default PipelineTemplate;
