import type { FieldProps } from "@rjsf/utils";
import { Button, Form } from "react-bootstrap";
import { FileEarmarkCheck, FileEarmarkPlus, XLg } from "react-bootstrap-icons";
import { Horizontal, Vertical } from "../ui/Alignment";
import GroupHeading from "./GroupHeading";

/**
 * Renders the input for a field naming a single file (a codebook, an initiator or readout probe
 * table). The picked `File` is held in the form data and swapped for its saved path by the
 * backend on submit, the same way the multi-file inputs work.
 *
 * @param props - FieldProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props})
 * @returns A React Component that accepts one file, showing which is selected
 */
const SingleFileInput = (props: FieldProps) => {
    const {
        fieldPathId,
        formData,
        onChange,
        onBlur,
        schema,
        uiSchema,
        rawErrors,
        registry,
    } = props;
    const { $id: id, path } = fieldPathId;
    const {
        templates: { FieldErrorTemplate },
    } = registry;

    // An imported config carries the file name as a string; a fresh pick is a File.
    const fileName = formData instanceof File ? formData.name : formData;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onChange(file, path);
        }
        event.target.value = ""; // let the same file be picked again
        onBlur(id, formData);
    };

    const handleClear = () => {
        onChange(undefined, path);
        onBlur(id, formData);
    };

    return (
        <Vertical gap="sm" className="mb-2">
            <GroupHeading
                id={id}
                title={schema.title}
                description={schema.description}
                className="mb-0"
            />

            {fileName ? (
                <Horizontal gap="sm" align="center" className="single-file">
                    <FileEarmarkCheck
                        size="18"
                        className="text-muted flex-shrink-0"
                    />
                    <span className="text-truncate">{fileName}</span>
                    <Button
                        variant="link"
                        className="p-0 text-muted flex-shrink-0"
                        onClick={handleClear}
                        aria-label={`Remove ${fileName}`}
                    >
                        <XLg />
                    </Button>
                </Horizontal>
            ) : (
                <div className="text-muted">No file provided.</div>
            )}

            <FieldErrorTemplate
                schema={schema}
                uiSchema={uiSchema}
                fieldPathId={fieldPathId}
                errors={rawErrors}
                registry={registry}
            />

            <Form.Label className="btn btn-outline-border filled text-black mb-0 align-self-start">
                <FileEarmarkPlus size="18" className="me-2" />
                Upload File
                <Form.Control
                    type="file"
                    className="visually-hidden"
                    id={id}
                    name={fieldPathId.name ?? id}
                    onChange={handleChange}
                />
            </Form.Label>
        </Vertical>
    );
};

export default SingleFileInput;
