import { getUiOptions, type BaseInputTemplateProps } from "@rjsf/utils";
import { getDefaultRegistry } from "@rjsf/core";
import { Form } from "react-bootstrap";
import { ToolTip } from "../ui/Tooltip";
import { memo } from "react";

const {
    templates: { BaseInputTemplate },
} = getDefaultRegistry();

const WrappedBaseInputTemplate = memo((props: BaseInputTemplateProps) => {
    const { id, label, hideLabel, uiSchema, schema } = props;

    const uiOptions = getUiOptions(uiSchema);
    const isCheckbox = uiOptions.widget === "checkbox";

    return (
        <>
            {!hideLabel && !isCheckbox && (
                <Form.Label htmlFor={id}>{label}</Form.Label>
            )}
            {!hideLabel && schema.description ? (
                <ToolTip id={id} tip={schema.description} />
            ) : null}
            <BaseInputTemplate {...props} />
        </>
    );
});

export default WrappedBaseInputTemplate;
