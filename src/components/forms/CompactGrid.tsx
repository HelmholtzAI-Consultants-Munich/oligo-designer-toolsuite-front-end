import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { isQuickSetting, spansFullRow } from "./utils";

/** Compact fields always sit in the same four columns, so their boxes line up group to group. */
const GRID_COLUMNS = "repeat(4, 1fr)";

type CompactGridProps = Pick<
    ObjectFieldTemplateProps,
    "schema" | "properties" | "uiSchema"
> & {
    className?: string;
};

/**
 * Lays out a field group: scalars share the compact columns, anything that lays out
 * its own children spans the full row.
 *
 * @param props - the group's `schema`, `uiSchema` and `properties`, plus classes for the grid's gaps
 * @returns A React Component holding the group's fields
 */
const CompactGrid = memo(function CompactGrid({
    schema,
    uiSchema,
    properties,
    className = "",
}: CompactGridProps) {
    return (
        <div
            className={`d-grid column-gap-3 ${className}`}
            style={{ gridTemplateColumns: GRID_COLUMNS }}
        >
            {properties.map(({ name, content }) =>
                // a quick setting still renders here - that is what creates its portal - but
                // without a grid cell, which would otherwise be left empty
                spansFullRow(schema.properties?.[name], uiSchema?.[name]) ||
                isQuickSetting(schema.properties?.[name], uiSchema?.[name]) ? (
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
