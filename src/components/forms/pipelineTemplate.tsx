import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import type { Status, Modal, RJSFFormData } from "../types";
import FieldTemplate from "./FieldTemplate";
import { TabsLayout } from "./TabsLayout";
import { RunLinkModal } from "../modal/RunLinkModal";
import { InfoModal } from "../modal/InfoModal";
import Ajv2020 from "ajv/dist/2020";
import { Navbar } from "react-bootstrap";
import type { FastaFormState, FileState } from "../fastaGenerateForm/types";
import fileorGenerator from "../fastaGenerateForm/genomicSourceSelector";
import { handleSubmit } from "../fastaGenerateForm/helpers";

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
        fileSelection: fileorGenerator,
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
                        onSubmit={() =>
                            handleSubmit(
                                runStatus,
                                setRunStatus,
                                setRunId,
                                setModal,
                                files,
                                fastaForms,
                                formData,
                                pipeline
                            )
                        }
                    />
                    {runStatus === "submitting" && <p>Submitting...</p>}
                </div>
            </div>
        </>
    );
};

export default PipelineTemplate;
