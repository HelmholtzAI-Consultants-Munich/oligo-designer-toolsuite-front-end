import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { COMPACT_GRID_COLUMNS, spansFullRow } from "./utils";

type Props = Pick<
    ObjectFieldTemplateProps,
    "schema" | "properties" | "uiSchema"
> & {
    className?: string;
};

/**
 * Lays out a field group's properties: scalars share the compact columns, everything
 * that lays out its own children spans the full row.
 *
 * @param props - the group's `schema`, `uiSchema` and `properties`, plus classes for the grid's gaps
 * @returns A React Component holding the group's fields
 */
const CompactGrid = memo(function CompactGrid({
    schema,
    uiSchema,
    properties,
    className,
}: Props) {
    return (
        <div
            className={`d-grid column-gap-3 ${className ?? ""}`}
            style={{ gridTemplateColumns: COMPACT_GRID_COLUMNS }}
        >
            {properties.map(({ name, content }) =>
                spansFullRow(schema.properties?.[name], uiSchema?.[name]) ? (
                    <Fragment key={name}>{content}</Fragment>
                ) : (
                    <div key={name} className="compact-field-item">
                        {content}
                    </div>
                )
            )}
        </div>
    );
});

export default CompactGrid;
