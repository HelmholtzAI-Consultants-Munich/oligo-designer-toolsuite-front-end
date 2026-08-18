import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { quickSettingGroup, spansFullRow } from "./utils";

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
 * @remarks
 * Used by `ObjectFieldTemplate`, `SectionLayout` and `CollapsibleSectionLayout` - the three
 * object layouts that hold a plain grid of fields.
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
        // `.compact-grid` sets the columns every group shares, `className` only its row gap
        <div className={`compact-grid d-grid column-gap-3 ${className}`}>
            {properties.map(({ name, content }) => {
                const fieldSchema = schema.properties?.[name];
                const fieldUiSchema = uiSchema?.[name];
                // a quick setting still renders here - that is what creates its portal - but
                // without a grid cell, which would otherwise be left empty
                return spansFullRow(fieldSchema, fieldUiSchema) ||
                    quickSettingGroup(fieldSchema, fieldUiSchema) ? (
                    <Fragment key={name}>{content}</Fragment>
                ) : (
                    <div key={name} className="compact-field-item">
                        {content}
                    </div>
                );
            })}
        </div>
    );
});

export default CompactGrid;
