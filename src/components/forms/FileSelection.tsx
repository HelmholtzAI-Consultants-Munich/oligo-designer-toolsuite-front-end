import type { WidgetProps } from "@rjsf/utils";
import { handleFileChange } from "../helpers";
import { Form } from "react-bootstrap";

const FileSelection = ({ id, name, registry }: WidgetProps) => {
    const { files, setFiles } = registry.formContext;

    return (
        <>
            <Form.Control
                type="file"
                id={id}
                name={name}
                onChange={(e) => {
                    handleFileChange(
                        e as React.ChangeEvent<HTMLInputElement>,
                        setFiles
                    );
                }}
                multiple
            />
            <p className="text-muted small">
                {files[name].length > 0
                    ? `Selected: ${files[name].map((f: File) => f.name).join(", ")}`
                    : "No files selected"}
            </p>
        </>
    );
};
export default FileSelection;
