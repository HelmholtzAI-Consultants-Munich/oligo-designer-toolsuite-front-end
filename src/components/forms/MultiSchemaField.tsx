import { getDefaultRegistry } from "@rjsf/core";
import {
    type FieldProps,
    type MultiSchemaFieldTemplateProps,
    type RJSFSchema,
} from "@rjsf/utils";
import { ToolTip } from "../ui/Tooltip";
import { Card, Form } from "react-bootstrap";
import { memo } from "react";
import { spaceBeforeCapitalLetters } from "./utils";

const {
    fields: { AnyOfField, OneOfField },
} = getDefaultRegistry();

const WrappedAnyOfField = memo(function WrappedAnyOfField(
    props: React.ComponentProps<typeof AnyOfField>
) {
    const { schema, registry, fieldPathId, uiSchema } = props as FieldProps;
    const { SchemaField } = registry.fields;

    if (
        schema.anyOf?.length === 2 &&
        schema.anyOf.find(
            (option) => typeof option === "object" && option.type === "null"
        )
    ) {
        // return just the non-null option and treat it as optional
        const nonNullIndex = schema.anyOf.findIndex(
            (option) => typeof option === "object" && option.type !== "null"
        );
        const baseNonNullSchema = schema.anyOf[nonNullIndex] as RJSFSchema;

        const nonNullSchema = {
            ...baseNonNullSchema,
            title: schema.title, // preserve title from parent schema
            description: schema.description, // preserve description from parent schema
        };

        const isEnum = nonNullSchema.enum !== undefined;

        return (
            <>
                {isEnum && (
                    <Form.Label htmlFor={fieldPathId.$id}>
                        {schema.title}
                    </Form.Label>
                )}
                {isEnum && schema.description ? (
                    <ToolTip id={schema.$id!} tip={schema.description} />
                ) : null}
                <SchemaField
                    {...props}
                    onChange={(value) => {
                        if (value === "") {
                            props.onChange(null, fieldPathId.path);
                        } else {
                            props.onChange(value, fieldPathId.path);
                        }
                    }}
                    schema={nonNullSchema}
                    uiSchema={uiSchema}
                />
            </>
        );
    }

    return <AnyOfField {...props} />;
});

const WrappedOneOfField = memo(function WrappedOneOfField(
    props: React.ComponentProps<typeof OneOfField>
) {
    const { schema } = props;

    if (schema?.discriminator?.propertyName === "enabled") {
        // This is a special case for handling "enabled"/"disabled" options in a more user-friendly way
        return (
            <div className="multi-schema-toggle">
                <OneOfField {...props} />
            </div>
        );
    }

    return <OneOfField {...props} />;
});

const MultiSchemaFieldTemplate = memo(function MultiSchemaFieldTemplate(
    props: MultiSchemaFieldTemplateProps
) {
    const { selector, optionSchemaField, schema } = props;
    return (
        <>
            {schema.description ? (
                <ToolTip id={schema.$id!} tip={schema.description} />
            ) : null}
            <Card
                style={{
                    marginBottom: "1rem",
                    backgroundColor: "var(--bs-primary-bg-subtle)",
                }}
            >
                <Card.Body>
                    {schema.title && (
                        <span className="super-label">
                            {spaceBeforeCapitalLetters(schema.title)}
                        </span>
                    )}
                    <div className="multi-schema-selector">{selector}</div>
                    {optionSchemaField}
                </Card.Body>
            </Card>
        </>
    );
});

export { WrappedAnyOfField, WrappedOneOfField, MultiSchemaFieldTemplate };
