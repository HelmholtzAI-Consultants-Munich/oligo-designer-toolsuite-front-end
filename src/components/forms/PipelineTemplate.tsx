import { useEffect, useRef, useState } from "react";
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
import {
    buildExportPayload,
    triggerDownload,
    importAndValidate,
} from "./pipelineConfigIO";
import { useRuns } from "../../hooks/useRuns";
import { Button } from "react-bootstrap";
import type { NestedObject } from "../fastaGenerateForm/types";
import GenomicInput from "../fastaGenerateForm/GenomicInput";
import { showToast } from "../../utils/toastUtil";

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

    const { updateRuns } = useRuns();

    const fields = {
        fileSelection: GenomicInput,
    };

    const tabs = uiSchema?.["ui:tabs"] as TabConfig[] | undefined;

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
            const result = importAndValidate(parsed, schema, pipeline);
            if (!result.ok) {
                showToast({
                    title: "Import Failed",
                    content: result.error,
                    type: "danger",
                });
                return;
            }
            setFormData((prev) => ({
                ...prev,
                ...result.config,
            }));
            const skipNote =
                result.skippedFields.length > 0
                    ? ` Fields not in current schema were skipped: ${result.skippedFields.join(", ")}.`
                    : "";
            showToast({
                title: "Import Successful",
                content: `Configuration loaded.${skipNote}`,
                type: "success",
            });
        };
        reader.readAsText(file);
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
                    onClick: () => handleSubmit(formData, pipeline, updateRuns),
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
                templates={{
                    FieldTemplate: FieldTemplate,
                    ObjectFieldTemplate: TabsLayout,
                }}
                fields={fields}
                validator={validator}
                onChange={(e) => setFormData(e.formData)}
                onSubmit={() => handleSubmit(formData, pipeline, updateRuns)}
            >
                <Button type="submit" variant="primary">
                    Run Pipeline <Send className="ms-2" />
                </Button>
            </Form>
        </Page>
    );
};

export default PipelineTemplate;
