import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import { ToolTip } from "../ui/Tooltip";
import { spaceBeforeCapitalLetters } from "./utils";

// Each field's own template stretches its input to fill whatever space it's
// given (so labels stay left-aligned elsewhere in the form). Here, only the
// input box itself should be small (see the `.compact-field-item` rule in
// theme.scss) - the label is left to size naturally so longer field names
// don't get clipped and overlap into the next box.

/**
 * Layout for a nested object made up entirely of small scalar fields (e.g. per-base
 * thresholds). Renders the fields as a compact inline row instead of the usual
 * full-width grid, since each field only needs a small box.
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
        <div style={{ gridColumn: "1 / -1" }}>
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
            <div className="d-flex flex-wrap align-items-center gap-3 mt-1">
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
