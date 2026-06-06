import { type FieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";

/**
 * This FieldTemplate is based on the react-bootstrap theme's template.
 * It removes the `WrapIfAdditionalTemplate` wrapper, as it wrapped all fields in an unpredictable way, making consistent styling difficult.
 * It also removes the field description, as it would be redundant with tooltips rendered in other template overrides.
 * Lastly, it is designed to be used in a CSS grid layout, allowing fields to span the full width of the form when necessary (e.g. for object fields or custom fields).
 */
const FieldTemplate = memo(function FieldTemplate(props: FieldTemplateProps) {
    const { children, errors, help, hidden, schema, uiSchema } = props;

    if (hidden) {
        return <div className="hidden">{children}</div>;
    }

    const spanFullWidth =
        schema.type === "object" || schema.oneOf || uiSchema?.["ui:field"];

    return (
        <div
            style={{
                gridColumn: spanFullWidth ? "1 / -1" : undefined,
            }}
            className={`rjsf-field rjsf-field-${schema.type}`}
        >
            {children}
            {errors}
            {help}
        </div>
    );
});

export default FieldTemplate;
