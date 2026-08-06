import { type FieldTemplateProps, ANY_OF_KEY, ONE_OF_KEY } from "@rjsf/utils";
import { memo } from "react";
import { filterUninformativeErrors, spansFullRow } from "./utils";

/**
 * This FieldTemplate is based on the react-bootstrap theme's template.
 * It drops the `WrapIfAdditionalTemplate` wrapper, which wrapped fields unpredictably, and the
 * field description, which the tooltips already cover. Fields sit in a CSS grid, spanning the
 * full row when they lay out their own children.
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

    const filteredErrors = rawErrors?.filter((error) =>
        filterUninformativeErrors(error)
    );

    return (
        <div
            style={{
                gridColumn: spansFullRow(schema, uiSchema)
                    ? "1 / -1"
                    : undefined,
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
