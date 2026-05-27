import { type FieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";

const FieldTemplate = memo(function FieldTemplate(props: FieldTemplateProps) {
    const { children, errors, help, hidden, schema } = props;

    if (hidden) {
        return <div className="hidden">{children}</div>;
    }

    console.log("Rendering FieldTemplate for schema:", schema);

    const spanFullWidth =
        schema.type === "object" || schema.type === "array" || schema.oneOf;

    return (
        <div
            style={{
                gridColumn: spanFullWidth ? "1 / -1" : undefined,
            }}
            className={`rjsf-field rjsf-field-${schema.type}`}
        >
            {children}
            {errors}
            {help}
        </div>
    );
});

export default FieldTemplate;
