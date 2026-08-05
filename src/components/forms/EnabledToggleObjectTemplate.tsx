import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { ToolTip } from "../ui/Tooltip";
import { spaceBeforeCapitalLetters } from "./utils";

/**
 * Layout for a schema discriminated by an "enabled" boolean (e.g. optional filters).
 * Renders the enabled checkbox and the field's name on a header row, and the rest of
 * the fields (only present while enabled) stacked below it, each on its own line.
 *
 * @remarks
 * This component is used in `uiSchemaFromJsonSchemaRecursive`, applied to the option
 * schemas of any `oneOf` discriminated by `enabled` (set via a Pydantic `discriminator`).
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that lays out an enabled/disabled toggle and its fields
 */
const EnabledToggleObjectTemplate = memo(function EnabledToggleObjectTemplate(
    props: ObjectFieldTemplateProps
) {
    const enabledProperty = props.properties.find(
        (property) => property.name === "enabled"
    );
    const otherProperties = props.properties.filter(
        (property) => property.name !== "enabled"
    );

    return (
        <div style={{ gridColumn: "1 / -1" }}>
            <div className="d-flex align-items-center gap-2">
                <div className="d-flex align-items-center gap-2">
                    <span className="super-label mb-0">
                        {spaceBeforeCapitalLetters(props.title)}
                    </span>
                    {props.description && (
                        <ToolTip
                            id={props.fieldPathId.$id}
                            tip={props.description.toString()}
                        />
                    )}
                </div>
                <div
                    className="flex-shrink-0"
                    style={{ flexGrow: 0, marginLeft: "auto" }}
                >
                    {enabledProperty?.content}
                </div>
            </div>
            {otherProperties.length > 0 && (
                <div className="d-flex flex-column gap-3 mt-2">
                    {otherProperties.map((element) => (
                        <Fragment key={element.name}>
                            {element.content}
                        </Fragment>
                    ))}
                </div>
            )}
        </div>
    );
});

export default EnabledToggleObjectTemplate;
