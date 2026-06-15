import { type ChangeEvent } from "react";
import type { FieldProps } from "@rjsf/utils";
import { Form, InputGroup } from "react-bootstrap";
import { FiletypeTxt } from "react-bootstrap-icons";

const TxtUploadInput = (props: FieldProps) => {
    const {
        onChange,
        fieldPathId,
        formData,
        onBlur,
        schema,
        uiSchema,
        rawErrors,
        registry,
    } = props;

    const {
        templates: { FieldErrorTemplate },
    } = registry;

    const handleTxtUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                let text = event.target?.result as string;
                // multi line to comma separated
                text = text
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line)
                    .join(", ");
                onChange(text, fieldPathId.path);
            };
            reader.readAsText(file);
        }
        onBlur(fieldPathId.$id, formData);
    };

    const emptyStringToNull = (value: string) => (value === "" ? null : value);

    return (
        <>
            <Form.Label htmlFor={fieldPathId.$id} className="super-label mb-1">
                Region Ids
            </Form.Label>
            <InputGroup>
                <Form.Control
                    id={fieldPathId.$id}
                    onBlur={() => onBlur(fieldPathId.$id, formData)}
                    type="input"
                    onChange={(e) =>
                        onChange(
                            emptyStringToNull(e.target.value),
                            fieldPathId.path
                        )
                    }
                    value={formData || ""}
                />
                <Form.Control
                    type="file"
                    accept=".txt"
                    className="visually-hidden"
                    id="txt-upload"
                    name="txt-upload"
                    onChange={handleTxtUpload}
                />
                <Form.Label
                    htmlFor="txt-upload"
                    className="btn btn-outline-border filled mb-0"
                >
                    File Upload
                    <FiletypeTxt size={20} className="ms-2" />
                </Form.Label>
            </InputGroup>
            <FieldErrorTemplate
                schema={schema}
                uiSchema={uiSchema}
                fieldPathId={fieldPathId}
                errors={rawErrors}
                registry={registry}
            />
        </>
    );
};

export default TxtUploadInput;
