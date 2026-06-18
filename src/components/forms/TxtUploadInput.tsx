import { type ChangeEvent } from "react";
import type { FieldProps } from "@rjsf/utils";
import { Form, InputGroup } from "react-bootstrap";
import { FiletypeTxt } from "react-bootstrap-icons";
import { ToolTip } from "../ui/Tooltip";

const TxtUploadInput = (props: FieldProps) => {
    const { onChange, fieldPathId, formData, onBlur, schema } = props;

    const allGenesChecked = formData === null;

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
            e.target.value = ""; // reset file input
        }
        onBlur(fieldPathId.$id, formData);
    };

    const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onChange(null, fieldPathId.path);
        } else if (formData === null) {
            onChange(undefined, fieldPathId.path);
        }
    };

    const emptyStringToUndefined = (value: string) =>
        value === "" ? undefined : value;

    return (
        <>
            <Form.Label htmlFor={fieldPathId.$id} className="super-label mb-1">
                Region Ids
                {schema.description && (
                    <ToolTip id={fieldPathId.$id} tip={schema.description} />
                )}
            </Form.Label>
            <InputGroup>
                <InputGroup.Checkbox
                    checked={allGenesChecked}
                    onChange={handleCheckboxChange}
                    className="mt-0"
                    aria-label="Checkbox for following text input"
                />
                <InputGroup.Text className="border-start-0 ps-0">
                    Use all genes
                </InputGroup.Text>
                <Form.Control
                    disabled={allGenesChecked}
                    id={fieldPathId.$id}
                    onBlur={() => onBlur(fieldPathId.$id, formData)}
                    type="input"
                    onChange={(e) =>
                        onChange(
                            emptyStringToUndefined(e.target.value),
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
        </>
    );
};

export default TxtUploadInput;
