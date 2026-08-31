import type { FieldPathList, FieldProps } from "@rjsf/utils";
import {
    type GenomicForm,
    type GenomicFormOrFile,
} from "../fastaGenerateForm/types";
import FastaGenerateForm from "../fastaGenerateForm/FastaGenerateForm";
import { showModal } from "../../utils/modalUtil";
import { Button, Form } from "react-bootstrap";
import { Grid, Vertical } from "../ui/Alignment";
import { InputList } from "../fastaGenerateForm/InputList";
import { ToolTip } from "../ui/Tooltip";
import { FileEarmarkPlus } from "react-bootstrap-icons";
import { spaceBeforeCapitalLetters } from "./utils";

type ConfigurableGenomicInputProps = FieldProps & {
    formsAllowed: boolean;
    filesAllowed: boolean;
};
/**
 * Renders a Component for inputting genomic data, either via uploading a file and/or via configuring a Genomic Region
 * Generator Form. Which variant is allowed is configured via the `formsAllowed` and `filesAllowed` props.
 *
 * @param props - FieldProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props})
 * @param formsAllowed - whether the Genomic Input allows that Genomic Region Generators Form can be used as input
 * @param filesAllowed - whether the Genomic Input allows that file uploads can be used as input
 * @returns A React Component that can be configured to accept different types of Genomic Input
 */
const ConfigurableGenomicInput = ({
    fieldPathId,
    name,
    schema,
    uiSchema,
    // RJSF omits a nested default when an ancestor object is supplied
    // (`nestedDefaultsPrecedence: "ancestorWins"`), so an imported config naming this field's
    // parent but not the field itself arrives here as undefined.
    formData = [],
    onChange,
    onBlur,
    formsAllowed,
    filesAllowed,
    rawErrors,
    registry,
}: ConfigurableGenomicInputProps) => {
    // TODO: Currently they do not point to the buttons, but it would be good if they would do it, since
    // it would make the page more accessible and playwright tests would be easier
    const { $id: id, path } = fieldPathId;
    const {
        templates: { FieldErrorTemplate },
    } = registry;

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

            <FieldErrorTemplate
                schema={schema}
                uiSchema={uiSchema}
                fieldPathId={fieldPathId}
                errors={rawErrors}
                registry={registry}
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

/**
 * Renders a component that allows uploading a File, which is used as the Input
 * for the Genomic Region Generator.
 *
 * @param id - unique ID of the component
 * @param name - name of the component
 * @param onUpload - callback which is called, when the input
 * is changed (e.g a File is uploaded)
 * @returns A React Component that allows uploading a file.
 */
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

/**
 * Renders a Component for inputting genomic data via uploading a file and via configuring a Genomic Region
 * Generator Form.
 *
 * It wraps the `ConfigurableGenomicInput` component.
 *
 * @param props - FieldProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props}). These are passed to the underlying `ConfigurableGenomicInput` component.
 * @returns A React Component which accepts genomic data via uploading a file and via configuring the Genomic Region Generator
 */
export const GenomicAndFileInput = (props: FieldProps) => {
    return (
        <ConfigurableGenomicInput
            {...props}
            formsAllowed={true}
            filesAllowed={true}
        />
    );
};

/**
 * Renders a Component for inputting genomic data via configuring a Genomic Region
 * Generator Form.
 *
 * It wraps the `ConfigurableGenomicInput` component.
 *
 * @param props - FieldProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props}). These are passed to the underlying `ConfigurableGenomicInput` component.
 * @returns A React Component which accepts genomic data via configuring the Genomic Region Generator
 */
export const GenomicInput = (props: FieldProps) => {
    return (
        <ConfigurableGenomicInput
            {...props}
            formsAllowed={true}
            filesAllowed={false}
        />
    );
};

/**
 * Renders a Component for inputting genomic data, via uploading a file.
 *
 * It wraps the `ConfigurableGenomicInput` component.
 *
 * @param props - FieldProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props}). These are passed to the underlying `ConfigurableGenomicInput` component.
 * @returns A React Component which accepts genomic data via uploading a file
 */
export const FileInput = (props: FieldProps) => {
    return (
        <ConfigurableGenomicInput
            {...props}
            formsAllowed={false}
            filesAllowed={true}
        />
    );
};
