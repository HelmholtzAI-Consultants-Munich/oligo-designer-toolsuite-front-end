import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import Navbar from "../modules/nav";
import type {
    FileState,
    Status,
    Modal,
    RJSFFormData,
} from "../components/types";
import { handleSubmit } from "../components/helpers";
import FieldTemplate from "../components/fieldTemplate";
import { TabsLayout } from "../components/tabs";
import FileSelection from "../components/fileSelection";
import { RunLinkModal } from "../components/modal/RunLinkModal";
import { InfoModal } from "../components/modal/InfoModal";
import Ajv2020 from "ajv/dist/2020";

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
export default PipelineTemplate;
