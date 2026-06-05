import type { FieldPathList, FieldProps } from "@rjsf/utils";
import { type GenomicForm, type GenomicFormOrFile } from "./types";
import FastaGenerateForm from "../forms/FastaGenerateForm";
import { showModal } from "../../utils/modalUtil";
import { Button, Form } from "react-bootstrap";
import { Grid, Vertical } from "../ui/Alignment";
import { InputList } from "./InputList";
import { ToolTip } from "../ui/Tooltip";
import { FileEarmarkPlus } from "react-bootstrap-icons";
import { spaceBeforeCapitalLetters } from "../forms/utils";

type ConfigurableGenomicInputProps = FieldProps & {
    formsAllowed: boolean;
    filesAllowed: boolean;
};

const ConfigurableGenomicInput = ({
    fieldPathId: { $id, path },
    name,
    schema,
    formData,
    onChange,
    onBlur,
    formsAllowed,
    filesAllowed,
}: ConfigurableGenomicInputProps) => {
    // TODO: Currently they do not point to the buttons, but it would be good if they would do it, since
    // it would make the page more accessible and playwright tests would be easier
    const id = $id;

    const handleGenomicFormNew = () => {
        handleGenomicFormEdit(null, onChange, formData.length);
    };

    const handleRemove = (idx: number) => {
        onChange(
            formData.filter((_: GenomicFormOrFile, i: number) => i !== idx),
            path
        );
        onBlur(id, formData);
    };

    const handleGenomicFormEdit = (
        form: GenomicForm | null,
        onChange: (newValue: GenomicForm[], path: FieldPathList) => void,
        idx: number
    ) => {
        const formChangeHandler = (updatedForm: GenomicForm) => {
            if (formData.length > idx) {
                onChange(
                    formData.map((f: GenomicForm, i: number) =>
                        i === idx ? updatedForm : f
                    ),
                    path
                );
            } else {
                onChange([...formData, updatedForm], path);
            }
            onBlur(id, formData);
        };

        showModal({
            rawContent: (
                <FastaGenerateForm
                    id={`${id}-${idx}`}
                    key={`${id} ${idx}`}
                    form={form}
                    onChange={formChangeHandler}
                    schema={schema}
                />
            ),
            centered: true,
            ignoreBackdropClick: true,
            dialogClassName: "modal-wide",
        });
    };

    const handleFilesUpload = (newFiles: File[]) => {
        onChange([...formData, ...newFiles], path);
        onBlur(id, formData);
    };

    return (
        <Vertical gap="sm" className="mb-2">
            <span>
                {schema.title && (
                    <span className="super-label mb-0">
                        {spaceBeforeCapitalLetters(schema.title)}
                    </span>
                )}
                {schema.description && (
                    <ToolTip id={id} tip={schema.description} />
                )}
            </span>

            {formData.length === 0 && (
                <div className="text-muted">
                    No{" "}
                    {formsAllowed && filesAllowed
                        ? "genomic region forms or files"
                        : formsAllowed
                          ? "genomic region forms"
                          : "files"}{" "}
                    provided.
                </div>
            )}

            <InputList
                id={id}
                inputs={(formData as GenomicFormOrFile[]).map((data) => {
                    if (Object.hasOwn(data, "source")) {
                        return {
                            type: "form",
                            data: data as GenomicForm,
                            editHandler: () =>
                                handleGenomicFormEdit(
                                    data as GenomicForm,
                                    onChange,
                                    formData.indexOf(data)
                                ),
                            removeHandler: () =>
                                handleRemove(formData.indexOf(data)),
                        };
                    } else {
                        return {
                            type: "file",
                            data: data as File,
                            removeHandler: () =>
                                handleRemove(formData.indexOf(data)),
                        };
                    }
                })}
            />

            <Grid gap="md" className="w-100">
                {formsAllowed && (
                    <Button
                        variant="primary-muted"
                        name={name}
                        onClick={handleGenomicFormNew}
                    >
                        <FileEarmarkPlus size="18" className="me-2" />
                        Genomic Regions
                    </Button>
                )}
                {filesAllowed && (
                    <FileUpload
                        id={id}
                        name={name}
                        onUpload={handleFilesUpload}
                    />
                )}
            </Grid>
        </Vertical>
    );
};

interface FileUploadProps {
    id: string;
    name: string;
    onUpload: (files: File[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    id,
    name,
    onUpload,
}) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { files: selectedFiles } = e.target;
        if (!selectedFiles) return;
        onUpload(Array.from(selectedFiles));
        e.target.value = ""; // Reset the input so the same file can be uploaded again if needed
    };

    return (
        <Form.Label className="btn btn-outline-border filled text-black mb-0">
            <FileEarmarkPlus size="18" className="me-2" />
            Upload File(s)
            <Form.Control
                type="file"
                className="visually-hidden"
                id={id}
                name={name}
                onChange={(e) => {
                    handleFileChange(e as React.ChangeEvent<HTMLInputElement>);
                }}
                multiple
            />
        </Form.Label>
    );
};

export const GenomicAndFileInput = (props: FieldProps) => {
    return (
        <ConfigurableGenomicInput
            {...props}
            formsAllowed={true}
            filesAllowed={true}
        />
    );
};

export const GenomicInput = (props: FieldProps) => {
    return (
        <ConfigurableGenomicInput
            {...props}
            formsAllowed={true}
            filesAllowed={false}
        />
    );
};

export const FileInput = (props: FieldProps) => {
    return (
        <ConfigurableGenomicInput
            {...props}
            formsAllowed={false}
            filesAllowed={true}
        />
    );
};
