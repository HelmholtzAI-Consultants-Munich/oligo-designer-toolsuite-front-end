import { getDefaultRegistry } from "@rjsf/core";
import {
    type FieldProps,
    type MultiSchemaFieldTemplateProps,
    type RJSFSchema,
} from "@rjsf/utils";
import { ToolTip } from "../ui/Tooltip";
import { Accordion, Card, Form } from "react-bootstrap";
import { memo } from "react";
import GroupHeading from "./GroupHeading";
import {
    isEnabledDiscriminated,
    isSectionLevel,
    spaceBeforeCapitalLetters,
} from "./utils";

const {
    fields: { AnyOfField, OneOfField },
} = getDefaultRegistry();

/**
 * The WrappedAnyOfField wraps the default AnyOfField.
 * It adds special handling for common patterns in our schema that represent optional fields.
 *
 * @param props - default Field props passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props})
 * @returns A React Component that is used to overwrite the default RJSF `AnyOfField`
 */
const WrappedAnyOfField = memo(function WrappedAnyOfField(
    props: React.ComponentProps<typeof AnyOfField>
) {
    const { schema, registry, fieldPathId, uiSchema } = props as FieldProps;
    const { SchemaField } = registry.fields;

    const constSchema = schema.anyOf?.find(
        (option) => typeof option === "object" && option.const
    ) as RJSFSchema | undefined;

    const nullSchema = schema.anyOf?.find(
        (option) => typeof option === "object" && option.type === "null"
    ) as RJSFSchema | undefined;

    // a two-option anyOf against null is how our schema spells an optional field
    if (schema.anyOf?.length === 2 && nullSchema) {
        if (constSchema) {
            // turn const into enum for better handling of optional fields
            constSchema.enum = [constSchema.const!];
            constSchema.const = undefined;
        }

        // return just the non-null option and treat it as optional
        const nonNullSchema = schema.anyOf.find(
            (option) => typeof option === "object" && option.type !== "null"
        ) as RJSFSchema;

        const mergedSchema = {
            ...nonNullSchema,
            title: schema.title, // preserve title from parent schema
            description: schema.description, // preserve description from parent schema
        };

        // a checkbox holds two states, but a nullable boolean has three: unchecking one would
        // send `false`, which the pipeline does not read as "unset", with no way back to it
        const isNullableBoolean = mergedSchema.type === "boolean";

        // a select and an enum name themselves in the row's label, the other widgets do not
        const hasOwnLabel =
            mergedSchema.enum !== undefined || isNullableBoolean;

        return (
            <div className="field-row">
                {hasOwnLabel && (
                    <div className="field-row-label">
                        <Form.Label htmlFor={fieldPathId.$id} className="mb-0">
                            {schema.title}
                        </Form.Label>
                        <ToolTip id={schema.$id!} tip={schema.description} />
                    </div>
                )}
                <div className="field-row-control">
                    <SchemaField
                        {...props}
                        onChange={(value) =>
                            props.onChange(
                                value === "" ? null : value,
                                fieldPathId.path
                            )
                        }
                        schema={mergedSchema}
                        uiSchema={
                            // a select adds an empty option, which maps back to null above
                            isNullableBoolean
                                ? { ...uiSchema, "ui:widget": "select" }
                                : uiSchema
                        }
                    />
                </div>
            </div>
        );
    }

    return <AnyOfField {...props} />;
});

/**
 * The WrappedOneOfField wraps the default OneOfField.
 * It allows CSS-side hiding of the discriminator selector when the discriminator property is "enabled",
 * and gives a union standing in for a section the tab's accordion.
 *
 * @param props - default Field props passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#field-props})
 * @returns A React Component that is used to overwrite the default RJSF `OneOfField`
 */
const WrappedOneOfField = memo(function WrappedOneOfField(
    props: React.ComponentProps<typeof OneOfField>
) {
    const { schema, uiSchema, fieldPathId } = props as FieldProps;

    if (isEnabledDiscriminated(schema)) {
        // This is a special case for handling "enabled"/"disabled" options in a more user-friendly way
        return (
            <div className="multi-schema-toggle">
                <OneOfField {...props} />
            </div>
        );
    }

    // The accordion item is built here rather than in `MultiSchemaFieldTemplate`, which is
    // not handed the path id the tab uses as its section key.
    if (isSectionLevel(uiSchema)) {
        return (
            <Accordion.Item eventKey={fieldPathId.$id} className="form-section">
                <Accordion.Header>
                    {/* the header is itself a button, so the tip cannot be one */}
                    <span className="d-inline-flex align-items-center">
                        {spaceBeforeCapitalLetters(schema.title ?? "")}
                        <ToolTip
                            id={fieldPathId.$id}
                            tip={schema.description}
                            presentational
                        />
                    </span>
                </Accordion.Header>
                <Accordion.Body>
                    <OneOfField {...props} />
                </Accordion.Body>
            </Accordion.Item>
        );
    }

    return <OneOfField {...props} />;
});

/**
 * This MultiSchemaFieldTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of multi-schema fields (anyOf/oneOf) with ODT's design system.
 * It introduces a card layout with a title and a description tooltip (when available).
 *
 * @param props - MultiSchemaFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#multischemafieldtemplate})
 * @returns A React Component that is used to overwrite the default MultiSchemaFieldTemplate
 */
const MultiSchemaFieldTemplate = memo(function MultiSchemaFieldTemplate(
    props: MultiSchemaFieldTemplateProps
) {
    const { selector, optionSchemaField, schema, uiSchema } = props;

    // when discriminated by "enabled", the card is rendered by `EnabledToggleObjectTemplate`;
    // at section level, `WrappedOneOfField` has already put this in an accordion item
    if (isEnabledDiscriminated(schema) || isSectionLevel(uiSchema)) {
        return (
            <>
                <div className="multi-schema-selector">{selector}</div>
                {optionSchemaField}
            </>
        );
    }

    return (
        <Card className="multi-schema-card">
            <Card.Body>
                <GroupHeading
                    id={schema.$id!}
                    title={schema.title}
                    description={schema.description}
                />
                <div className="multi-schema-selector">{selector}</div>
                {optionSchemaField}
            </Card.Body>
        </Card>
    );
});

export { WrappedAnyOfField, WrappedOneOfField, MultiSchemaFieldTemplate };
