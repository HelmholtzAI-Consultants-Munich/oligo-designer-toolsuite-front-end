import { type FieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import { filterUninformativeErrors } from "./utils";

/**
 * This FieldTemplate is based on the react-bootstrap theme's template.
 * It removes the `WrapIfAdditionalTemplate` wrapper, as it wrapped all fields in an unpredictable way, making consistent styling difficult.
 * It also removes the field description, as it would be redundant with tooltips rendered in other template overrides.
 * Lastly, it is designed to be used in a CSS grid layout, allowing fields to span the full width of the form when necessary (e.g. for object fields or custom fields).
 */
const FieldTemplate = memo(function FieldTemplate(props: FieldTemplateProps) {
    const {
        children,
        rawErrors,
        help,
        hidden,
        schema,
        uiSchema,
        registry,
        fieldPathId,
    } = props;

    const {
        templates: { FieldErrorTemplate },
    } = registry;

    if (hidden) {
        return <div className="hidden">{children}</div>;
    }

    const isCustomField = !!uiSchema?.["ui:field"];

    const spanFullWidth =
        schema.type === "object" || schema.oneOf || isCustomField;

    const filteredErrors = rawErrors?.filter((error) =>
        filterUninformativeErrors(error)
    );

    return (
        <div
            style={{
                gridColumn: spanFullWidth ? "1 / -1" : undefined,
            }}
            className={`rjsf-field rjsf-field-${schema.type}`}
        >
            {children}
            {!isCustomField && (
                <FieldErrorTemplate
                    schema={schema}
                    uiSchema={uiSchema}
                    fieldPathId={fieldPathId}
                    errors={filteredErrors || []}
                    registry={registry}
                />
            )}
            {help}
        </div>
    );
});

export default FieldTemplate;
