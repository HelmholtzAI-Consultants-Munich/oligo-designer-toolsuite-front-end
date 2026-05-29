import {
    getUiOptions,
    type BaseInputTemplateProps,
    type ErrorSchema,
} from "@rjsf/utils";
import { getDefaultRegistry } from "@rjsf/core";
import { Form } from "react-bootstrap";
import { ToolTip } from "../ui/Tooltip";
import { memo } from "react";

const {
    templates: { BaseInputTemplate },
} = getDefaultRegistry();

const WrappedBaseInputTemplate = memo((props: BaseInputTemplateProps) => {
    const { id, label, hideLabel, uiSchema, schema, onChange, options } = props;

    const uiOptions = getUiOptions(uiSchema);
    const isCheckbox = uiOptions.widget === "checkbox";

    const _onChange = (
        value: unknown,
        errorSchema?: ErrorSchema,
        id?: string
    ) => {
        // convert empty string to null, unless the schema explicitly defines an empty value
        return onChange(
            value === undefined ? options.emptyValue || null : value,
            errorSchema,
            id
        );
    };

    return (
        <>
            {!hideLabel && !isCheckbox && (
                <Form.Label htmlFor={id}>{label}</Form.Label>
            )}
            {!hideLabel && schema.description ? (
                <ToolTip id={id} tip={schema.description} />
            ) : null}
            <BaseInputTemplate {...props} onChange={_onChange} />
        </>
    );
});

export default WrappedBaseInputTemplate;
