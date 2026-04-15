import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import type { FileState, RJSFFormData } from "../componentTypes";
import { handleSubmit } from "../fastaGenerateForm/helpers";
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
import { useRuns } from "../../hooks/useRuns";
import { Button } from "react-bootstrap";
import type { FastaFormState } from "../fastaGenerateForm/types";
import GenomicInput from "../fastaGenerateForm/GenomicInput";

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

    const widgets = {
        fileSelection: GenomicInput,
    };

    const tabs = uiSchema?.["ui:tabs"] as TabConfig[] | undefined;

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
                    onClick: () => {},
                },
                {
                    type: "button",
                    label: "Export Settings",
                    icon: BoxArrowUp,
                    variant: "outline-border",
                    onClick: () => {},
                },
                {
                    type: "button",
                    label: "Run Pipeline",
                    icon: Send,
                    variant: "primary",
                    onClick: () =>
                        handleSubmit(
                            files,
                            fastaForms,
                            formData,
                            pipeline,
                            updateRuns
                        ),
                },
            ]}
            stickyHeader
        >
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
                        files,
                        fastaForms,
                        formData,
                        pipeline,
                        updateRuns
                    )
                }
            >
                <Button type="submit" variant="primary">
                    Run Pipeline <Send className="ms-2" />
                </Button>
            </Form>
        </Page>
    );
};

export default PipelineTemplate;
