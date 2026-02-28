import type { WidgetProps } from "@rjsf/utils";
import { handleFileChange } from "../helpers";

const FileSelection = ({ id, name, registry }: WidgetProps) => {
    const { files, setFiles } = registry.formContext;

    return (
        <div className="flex-grow-1">
            <div className=" d-flex align-items-center">
                <input
                    type="file"
                    className="form-control visually-hidden"
                    id={id}
                    name={name}
                    onChange={(e) => {
                        handleFileChange(e, setFiles);
                    }}
                    multiple
                />
                <label
                    htmlFor={id}
                    className="btn btn-outline-primary me-2 flex-grow-1"
                    style={{ cursor: "pointer" }}
                >
                    Choose File
                </label>
            </div>
            <div className="text-muted small mt-1">
                {files[name].length > 0
                    ? `Selected: ${files[name].map((f: File) => f.name).join(", ")}`
                    : "No files selected"}
            </div>
        </div>
    );
};
export default FileSelection;
