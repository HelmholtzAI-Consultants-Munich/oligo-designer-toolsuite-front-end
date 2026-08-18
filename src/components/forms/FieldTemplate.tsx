import { type FieldTemplateProps, ANY_OF_KEY, ONE_OF_KEY } from "@rjsf/utils";
import { memo } from "react";
import { createPortal } from "react-dom";
import { useQuickSettingsContainer } from "../../hooks/useQuickSettings";
import {
    filterUninformativeErrors,
    quickSettingGroup,
    spansFullRow,
} from "./utils";

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

    const group = quickSettingGroup(schema, uiSchema);
    const quickSettingsContainer = useQuickSettingsContainer(
        group ?? "general"
    );

    if (hidden) {
        return <div className="hidden">{children}</div>;
    }

    // a quick setting keeps its place in the React tree, so its value, id and validation are
    // untouched, and only its markup moves into the panel above the tabs
    const quickSettingTarget = group && quickSettingsContainer;

    // conditions copied from rjsf core's SchemaField.tsx
    const isXxxOfField = schema[ANY_OF_KEY] || schema[ONE_OF_KEY];
    const showErrors =
        !uiSchema?.["ui:field"] &&
        !hideError &&
        !(isXxxOfField && !schemaUtils.isSelect(schema));

    const field = (
        <div
            style={{
                // A quick setting normally occupies one panel column, but a composite field
                // (a genome picker, a gene list) needs the whole row wherever it is drawn.
                gridColumn: spansFullRow(schema, uiSchema)
                    ? "1 / -1"
                    : undefined,
            }}
            className={`rjsf-field rjsf-field-${schema.type}`}
        >
            {children}
            {showErrors && (
                <FieldErrorTemplate
                    errors={rawErrors?.filter(filterUninformativeErrors)}
                    fieldPathId={fieldPathId}
                    schema={schema}
                    uiSchema={uiSchema}
                    registry={registry}
                />
            )}
            {help}
        </div>
    );

    return quickSettingTarget ? createPortal(field, quickSettingTarget) : field;
});

export default FieldTemplate;
