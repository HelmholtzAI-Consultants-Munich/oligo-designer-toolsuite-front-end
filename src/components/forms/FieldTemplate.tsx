import { type FieldTemplateProps, ANY_OF_KEY, ONE_OF_KEY } from "@rjsf/utils";
import { memo } from "react";
import { createPortal } from "react-dom";
import { useQuickSettingsContainer } from "../../hooks/useQuickSettings";
import {
    filterUninformativeErrors,
    isHiddenField,
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

    // a quick setting keeps its place in the React tree, so its value, id and validation are
    // untouched, and only its markup moves into its tab's panel
    const quickSettingTarget = group && quickSettingsContainer;

    // conditions copied from rjsf core's SchemaField.tsx
    const isXxxOfField = schema[ANY_OF_KEY] || schema[ONE_OF_KEY];
    const showErrors =
        !uiSchema?.["ui:field"] &&
        !hideError &&
        !(isXxxOfField && !schemaUtils.isSelect(schema));

    // `<input type="hidden">` renders no visible content, but the wrapper below is still a
    // real grid item unless told otherwise, leaving an empty cell (e.g. a discriminator's own
    // const field, next to the one field its choice actually leaves editable).
    const hidden = isHiddenField(uiSchema);

    const field = (
        <div
            style={{
                // A quick setting normally occupies one panel column, but a composite field
                // (a genome picker, a gene list) needs the whole row wherever it is drawn.
                gridColumn: spansFullRow(schema, uiSchema)
                    ? "1 / -1"
                    : undefined,
            }}
            className={`rjsf-field rjsf-field-${schema.type}${hidden ? " d-none" : ""}`}
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
