import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { FileState, formData, formDataKey } from "./types";
import { handleFileChange } from "./helpers";

type Props = {
    formData: formData;
    id: formDataKey;
    setFiles: React.Dispatch<React.SetStateAction<FileState>>;
    files: any;
};
const FileSelection: React.FC<Props> = ({ formData, id, setFiles, files }) => {
    const multiple = id === "file_regions_file" ? false : true;

    return (
        <div className="flex-grow-1">
            <div className=" d-flex align-items-center">
                <input
                    type="file"
                    className="form-control visually-hidden"
                    id={id}
                    name={id}
                    onChange={(e) => handleFileChange(e, setFiles)}
                    multiple={multiple}
                />
                <label
                    htmlFor={id}
                    className="btn btn-outline-primary me-2 flex-grow-1"
                    style={{ cursor: "pointer" }}
                >
                    Choose File
                </label>
                <OverlayTrigger
                    trigger="hover"
                    placement="top"
                    overlay={
                        <Popover id={id}>
                            <Popover.Body>{formData[id].comment}</Popover.Body>
                        </Popover>
                    }
                >
                    <InfoCircle
                        style={{
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            color: "#0d6efd",
                            marginLeft: "10px",
                        }}
                    />
                </OverlayTrigger>
            </div>
            <div className="text-muted small mt-1">
                {id === "file_regions_file"
                    ? files[id]
                        ? `Selected: ${files[id].name}`
                        : "No files selected"
                    : files[id].length > 0
                      ? `Selected: ${files[id].map((f: File) => f.name).join(", ")}`
                      : "No files selected"}
            </div>
        </div>
    );
};
export default FileSelection;
