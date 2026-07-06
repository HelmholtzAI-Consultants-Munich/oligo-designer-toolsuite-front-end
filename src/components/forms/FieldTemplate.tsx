import { type FieldTemplateProps, ANY_OF_KEY, ONE_OF_KEY } from "@rjsf/utils";
import { memo } from "react";
import { filterUninformativeErrors } from "./utils";

/**
 * This FieldTemplate is based on the react-bootstrap theme's template.
 * It removes the `WrapIfAdditionalTemplate` wrapper, as it wrapped all fields in an unpredictable way, making consistent styling difficult.
 * It also removes the field description, as it would be redundant with tooltips rendered in other template overrides.
 * Lastly, it is designed to be used in a CSS grid layout, allowing fields to span the full width of the form when necessary (e.g. for object fields or custom fields).
 *
 * @param props - FieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#fieldtemplate})
 * @returns A React Component that is used to overwrite the default FieldTemplate
 */
const FieldTemplate = memo(function FieldTemplate(props: FieldTemplateProps) {
    const {
        children,
        rawErrors,
        hideError,
        help,
        hidden,
        schema,
        uiSchema,
        registry,
        fieldPathId,
    } = props;

    const {
        templates: { FieldErrorTemplate },
        schemaUtils,
    } = registry;

    if (hidden) {
        return <div className="hidden">{children}</div>;
    }

    const isCustomField = !!uiSchema?.["ui:field"];
    const isXxxOfField = schema[ANY_OF_KEY] || schema[ONE_OF_KEY];

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
            {isCustomField ||
            /* conditions copied from rjsf core's SchemaField.tsx */
            hideError ||
            (isXxxOfField && !schemaUtils.isSelect(schema)) ? undefined : (
                <FieldErrorTemplate
                    errors={filteredErrors}
                    fieldPathId={fieldPathId}
                    schema={schema}
                    uiSchema={uiSchema}
                    registry={registry}
                />
            )}
            {help}
        </div>
    );
});

export default FieldTemplate;
