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
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { Vertical } from "../ui/Alignment";
import { Trash } from "react-bootstrap-icons";
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
    // Button templates are not overridden in the uiSchema
    const {
        ButtonTemplates: { AddButton },
    } = registry.templates;
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
                    <AddButton
                        id={buttonId(fieldPathId, "add")}
                        onClick={onAddClick}
                        disabled={disabled || readonly}
                        registry={registry}
                    />
                )}
            </Vertical>
        </div>
    );
});

const ArrayFieldItemTemplate = memo((props: ArrayFieldItemTemplateProps) => {
    const { children, hasToolbar, buttonsProps } = props;
    return (
        <div className="d-flex gap-1 array-field-item">
            {children}
            {hasToolbar && (
                <Button
                    variant="outline-border filled"
                    onClick={buttonsProps.onRemoveItem}
                    title="Remove FASTA"
                >
                    <Trash />
                </Button>
            )}
        </div>
    );
});

export { ArrayFieldTemplate, ArrayFieldItemTemplate };
