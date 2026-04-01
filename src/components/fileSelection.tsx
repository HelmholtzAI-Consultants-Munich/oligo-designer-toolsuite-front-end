import type { FileState } from "./types";

type Props = {
    name: keyof FileState;
    id: string;
    setFiles: React.Dispatch<React.SetStateAction<FileState>>;
    files: FileState;
};

const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<FileState>>
) => {
    const { name, files: selectedFiles } = e.target;
    if (!selectedFiles) return;

    setFiles((prevFiles) => ({
        ...prevFiles,

        [name]: Array.from(selectedFiles), // Multiple files (always an array)
    }));
};

const FileSelection: React.FC<Props> = ({ name, id, setFiles, files }) => {
    return (
        <div className="flex-grow-1 my-1">
            <div className="d-flex align-items-center">
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
                    className="btn btn-outline-primary flex-grow-1"
                    style={{ cursor: "pointer" }}
                >
                    Choose File
                </label>
            </div>
            <div className="text-muted small mt-1">
                {files[name].length > 0 ? (
                    <>
                        <p>{`Selected: ${files[name].map((f: File) => f.name).join(", ")}`}</p>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                                setFiles((prevFiles) => ({
                                    ...prevFiles,
                                    [name]: [],
                                }));
                            }}
                        >
                            Remove Selected Files
                        </button>
                    </>
                ) : (
                    "No files selected"
                )}
            </div>
        </div>
    );
};
export default FileSelection;
