import { Form } from "react-bootstrap";
import type { setterCallback } from "./types";
import { buildFileFunctions, changeHandlerAbstractFactory } from "./helpers";
import type { FieldPathList, FieldProps } from "@rjsf/utils";
import type { RJSFFormData } from "../componentTypes";
import type React from "react";
import { Grid, Vertical } from "../ui/Alignment";
import { InputList } from "./InputList";

interface FileUploadProps {
    id: string;
    name: string;
    setFiles: (callback: setterCallback<File>) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    id,
    name,
    setFiles,
}) => {
    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setFiles: (callback: setterCallback<File>) => void
    ) => {
        const { files: selectedFiles } = e.target;
        if (!selectedFiles) return;

        setFiles((prevFiles) => [...prevFiles, ...Array.from(selectedFiles)]);
    };

    return (
        <Form.Label className="btn btn-outline-border mb-0">
            Upload File(s)
            <Form.Control
                type="file"
                className="visually-hidden"
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
        </Form.Label>
    );
};

export const FileInput = ({
    fieldPathId: { $id, path },
    name,
    formData,
    onChange,
}: FieldProps) => {
    const { files, setFiles, handleFileRemove, FilePreview } =
        buildFileFunctions(formData, path, onChange);

    return (
        <Vertical gap="md">
            {files.length === 0 && (
                <div className="text-muted">No files uploaded.</div>
            )}
            <InputList
                id={$id}
                handleInputRemove={handleFileRemove}
                inputtedList={files}
                previewCallback={FilePreview}
            />
            <Grid gap="md" className="w-100">
                <FileUpload id={$id} name={name} setFiles={setFiles} />
            </Grid>
        </Vertical>
    );
};
