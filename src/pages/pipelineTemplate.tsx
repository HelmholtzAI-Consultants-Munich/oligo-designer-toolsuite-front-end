import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import validator from "@rjsf/validator-ajv8";
import type { UiSchema } from "@rjsf/utils";
import type { JSONSchema7 } from "json-schema";
import Navbar from "../modules/nav";
import type { FileState, Status, Modal, FormData } from "../components/types";
import { handleSubmit } from "../components/helpers";
import FieldTemplate from "../components/fieldTemplate";
import { TabsLayout } from "../components/tabs";
import FileSelection from "../components/fileSelection";
import { RunLinkModal } from "../components/modal/RunLinkModal";
import { InfoModal } from "../components/modal/InfoModal";

type Props = {
    pipeline: string;
    title: string;
    form: FormData;
    schema: JSONSchema7;
    uiSchema: UiSchema;
};

const Pipeline_Template: React.FC<Props> = ({
    pipeline,
    title,
    form,
    schema,
    uiSchema,
}) => {
    const [formData, setFormData] = useState<any>(form);

    const [files, setFiles] = useState<FileState>({
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    const [runId, setRunId] = useState<string | null>(null);
    const [runStatus, setRunStatus] = useState<Status>("idle");
    const [idCopySuccess, setIdCopySuccess] = useState<boolean>(false);
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
            <div className="mb-3">
                <div className="d-flex justify-content-center align-items-center mt-3">
                    <h2 className="mb-0">{title}</h2>
                </div>
                <div className="container my-4">
                    <Form
                        schema={schema}
                        uiSchema={uiSchema}
                        formContext={{
                            files,
                            setFiles,
                        }}
                        formData={formData}
                        fields={{ fileSelection: FileSelection }}
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
                                setIdCopySuccess,
                                pipeline
                            )
                        }
                    />
                </div>
            </div>
        </>
    );
};
export default Pipeline_Template;
