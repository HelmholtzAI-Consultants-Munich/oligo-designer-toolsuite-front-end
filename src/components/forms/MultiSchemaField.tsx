import { getDefaultRegistry } from '@rjsf/core';
import { type FieldProps, type RJSFSchema } from '@rjsf/utils';
import { ToolTip } from '../ui/Tooltip';
import { Form } from 'react-bootstrap';

const {
    fields: { AnyOfField, OneOfField },
} = getDefaultRegistry();

export const WrappedAnyOfField = function WrappedAnyOfField(props: React.ComponentProps<typeof AnyOfField>) {
    const { schema, registry, fieldPathId } = props as FieldProps;
    const { SchemaField } = registry.fields;

    if (schema.anyOf?.length === 2 && schema.anyOf.find((option) => typeof option === "object" && option.type === "null")) {
        // return just the non-null option and treat it as optional
        const nonNullIndex = schema.anyOf.findIndex((option) => typeof option === "object" && option.type !== "null");
        const baseNonNullSchema = schema.anyOf[nonNullIndex] as RJSFSchema;
        const nonNullUiSchema = props.uiSchema?.[nonNullIndex] || {};

        const nonNullSchema = {
            ...baseNonNullSchema,
            title: schema.title, // preserve title from parent schema
            description: schema.description, // preserve description from parent schema
        };

        const isEnum = nonNullSchema.enum !== undefined;

        return (
            <>
                {isEnum && <Form.Label htmlFor={fieldPathId.$id}>{schema.title}</Form.Label>}
                {isEnum && schema.description ? <ToolTip id={schema.$id!} tip={schema.description} /> : null}
                <SchemaField {...props} schema={nonNullSchema} uiSchema={nonNullUiSchema} />
            </>
        );
    }
    
    return (
        <AnyOfField {...props} />
    );
}

export const WrappedOneOfField = function WrappedOneOfField(props: React.ComponentProps<typeof OneOfField>) {
    const { schema } = props;

    if (schema?.discriminator?.propertyName === "enabled") {
        // This is a special case for handling "enabled"/"disabled" options in a more user-friendly way
        return (
            <div className="multi-schema-toggle">
                <OneOfField {...props} />
            </div>
        );
    }

    return (
        <OneOfField {...props} />
    );
}
