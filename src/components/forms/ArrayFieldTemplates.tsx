import {
    descriptionId,
    titleId,
    type ArrayFieldDescriptionProps,
    type ArrayFieldTitleProps,
    buttonId,
    getUiOptions,
    type ArrayFieldTemplateProps,
    type ArrayFieldItemTemplateProps,
} from "@rjsf/utils";
import { ToolTip } from "../ui/Tooltip";
import { memo } from "react";
import { Vertical } from "../ui/Alignment";
import { Plus, Trash } from "react-bootstrap-icons";
import { Button } from "react-bootstrap";

/**
 * This ArrayFieldTitleTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of array fields with ODT's design system.
 *
 * @param props - ArrayFieldTitleTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#arrayfieldtitletemplate})
 * @returns A React Component that is used to overwrite the default ArrayFieldTitleTemplate
 */
const ArrayFieldTitleTemplate = memo((props: ArrayFieldTitleProps) => {
    const { title, fieldPathId } = props;
    const id = titleId(fieldPathId);
    return <span id={id}>{title}</span>;
});

/**
 * This ArrayFieldDescriptionTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of array fields with ODT's design system.
 *
 * @param props - Array Field Description Template Props passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#arrayfielddescriptiontemplate})
 * @returns A React Component that is used to overwrite the default ArrayFieldDescriptionTemplate
 */
const ArrayFieldDescriptionTemplate = memo(
    (props: ArrayFieldDescriptionProps) => {
        const { description, fieldPathId } = props;
        const id = descriptionId(fieldPathId);

        if (!description) {
            return null;
        }

        return <ToolTip id={id} tip={description.toString()} />;
    }
);

/**
 * This ArrayFieldTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of array fields with ODT's design system.
 *
 * @param props - Array Field Template Props passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#arrayfieldtemplate})
 * @returns A React Component that is used to overwrite the default ArrayFieldTemplate
 */
const ArrayFieldTemplate = memo((props: ArrayFieldTemplateProps) => {
    const {
        canAdd,
        disabled,
        fieldPathId,
        uiSchema,
        items,
        optionalDataControl,
        onAddClick,
        readonly,
        registry,
        required,
        schema,
        title,
    } = props;
    const uiOptions = getUiOptions(uiSchema);
    const showOptionalDataControlInTitle = !readonly && !disabled;
    return (
        <div className="field-row">
            <div className="field-row-label">
                <ArrayFieldTitleTemplate
                    fieldPathId={fieldPathId}
                    title={uiOptions.title || title}
                    schema={schema}
                    uiSchema={uiSchema}
                    required={required}
                    registry={registry}
                    optionalDataControl={
                        showOptionalDataControlInTitle
                            ? optionalDataControl
                            : undefined
                    }
                />
                <ArrayFieldDescriptionTemplate
                    fieldPathId={fieldPathId}
                    description={uiOptions.description || schema.description}
                    schema={schema}
                    uiSchema={uiSchema}
                    registry={registry}
                />
            </div>
            <div className="field-row-control">
                <Vertical gap="sm" align="stretch">
                    {!showOptionalDataControlInTitle
                        ? optionalDataControl
                        : undefined}
                    {items}
                    {canAdd && (
                        <Button
                            variant="primary-muted"
                            size="sm"
                            className="align-self-start"
                            id={buttonId(fieldPathId, "add")}
                            onClick={onAddClick}
                            disabled={disabled || readonly}
                        >
                            <Plus size={18} />
                        </Button>
                    )}
                </Vertical>
            </div>
        </div>
    );
});

/**
 * This ArrayFieldItemTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of array field items with ODT's design system.
 *
 * @param props - Array Field Item Template Props passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#arrayfielditemtemplate})
 * @returns A React Component that is used to overwrite the default ArrayFieldItemTemplate
 */
const ArrayFieldItemTemplate = memo((props: ArrayFieldItemTemplateProps) => {
    const { children, hasToolbar, buttonsProps } = props;
    return (
        <div className="d-flex gap-1 array-field-item align-items-start">
            {children}
            {hasToolbar && (
                <Button
                    variant="outline-border filled"
                    onClick={buttonsProps.onRemoveItem}
                    title="Remove item"
                >
                    <Trash />
                </Button>
            )}
        </div>
    );
});

export { ArrayFieldTemplate, ArrayFieldItemTemplate };
