import { useEffect, type ChangeEvent } from "react";
import type { FieldProps } from "@rjsf/utils"
import { Form, InputGroup } from "react-bootstrap";
import { FiletypeTxt } from "react-bootstrap-icons";

const TxtUploadInput = (props: FieldProps) => {
    const { onChange, fieldPathId, formData } = props;

    useEffect(() => {
        if (formData === undefined) {
            onChange(null, fieldPathId.path);
        }
    }, [fieldPathId.path, formData, onChange]);

    return (
        <>
            <Form.Label htmlFor={fieldPathId.$id} className="super-label mb-1">
                Region Ids
            </Form.Label>
            <InputGroup>
                <Form.Control id={fieldPathId.$id} type="input" onChange={(e) => onChange(e.target.value, fieldPathId.path)} value={formData || ""} />
                <Form.Control
                    type="file"
                    className="visually-hidden"
                    id="txt-upload"
                    name="txt-upload"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                let text = event.target?.result as string;
                                // multi line to comma separated
                                text = text.split("\n").map(line => line.trim()).filter(line => line).join(", ");
                                onChange(text, fieldPathId.path);
                            };
                            reader.readAsText(file);
                        }
                    }}
                />
                <Form.Label htmlFor="txt-upload" className="btn btn-outline-border filled mb-0">
                    File Upload <FiletypeTxt size={20} className="ms-2" />
                </Form.Label>
            </InputGroup>
        </>
    )
}

export default TxtUploadInput
