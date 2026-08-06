import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import { ToolTip } from "../ui/Tooltip";
import { COMPACT_GRID_COLUMNS, spaceBeforeCapitalLetters } from "./utils";

/**
 * Layout for a nested object made up entirely of scalar fields (e.g. per-base thresholds),
 * rendered as a compact grid since each field only needs a small box.
 *
 * @remarks
 * This component is used in `uiSchemaFromJsonSchemaRecursive`, applied automatically
 * to any nested object whose properties are all scalar (no nested objects or arrays).
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that lays out a small group of scalar fields compactly
 */
const CompactFieldGroupTemplate = memo(function CompactFieldGroupTemplate(
    props: ObjectFieldTemplateProps
) {
    return (
        <div className="field-group-box">
            <div className="d-flex align-items-center gap-2">
                {props.title && (
                    <span className="super-label mb-0">
                        {spaceBeforeCapitalLetters(props.title)}
                    </span>
                )}
                {props.description && (
                    <ToolTip
                        id={props.fieldPathId.$id}
                        tip={props.description.toString()}
                    />
                )}
            </div>
            <div
                className="d-grid row-gap-2 column-gap-3"
                style={{ gridTemplateColumns: COMPACT_GRID_COLUMNS }}
            >
                {props.properties.map((element) => (
                    <div key={element.name} className="compact-field-item">
                        {element.content}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default CompactFieldGroupTemplate;
