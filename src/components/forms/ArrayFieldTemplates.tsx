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

const ArrayFieldTitleTemplate = memo((props: ArrayFieldTitleProps) => {
    const { title, fieldPathId } = props;
    const id = titleId(fieldPathId);
    return <span id={id}>{title}</span>;
});

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
        <div>
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
            <Vertical gap="sm" align="stretch" className="mt-2">
                {!showOptionalDataControlInTitle
                    ? optionalDataControl
                    : undefined}
                {items}
                {canAdd && (
                    <Button
                        variant="primary-muted"
                        id={buttonId(fieldPathId, "add")}
                        onClick={onAddClick}
                        disabled={disabled || readonly}
                    >
                        <Plus size={18} />
                    </Button>
                )}
            </Vertical>
        </div>
    );
});

/**
 * This ArrayFieldItemTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of array field items with ODT's design system.
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
