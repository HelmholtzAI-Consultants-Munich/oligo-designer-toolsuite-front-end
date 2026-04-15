import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { UiSchema, RJSFSchema } from "@rjsf/utils";
import type { FileState, RJSFFormData } from "../types";
import { handleSubmit } from "../helpers";
import FieldTemplate from "./FieldTemplate";
import { TabsLayout } from "./TabsLayout";
import FileSelection from "./FileSelection";
import Ajv2020 from "ajv/dist/2020";
import Page from "../ui/Page";
import {
    BoxArrowInDown,
    BoxArrowUp,
    CodeSlash,
    Send,
} from "react-bootstrap-icons";
import { useRuns } from "../../modules/useRuns";
import { Button } from "react-bootstrap";

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

    const [files, setFiles] = useState<FileState>({
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    const { updateRuns } = useRuns();

    const widgets = {
        fileSelection: FileSelection,
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
                        handleSubmit(files, formData, pipeline, updateRuns),
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
                    handleSubmit(files, formData, pipeline, updateRuns)
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
