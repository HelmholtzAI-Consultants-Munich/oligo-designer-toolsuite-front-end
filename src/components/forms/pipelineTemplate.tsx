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
import { Container } from "react-bootstrap";

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
