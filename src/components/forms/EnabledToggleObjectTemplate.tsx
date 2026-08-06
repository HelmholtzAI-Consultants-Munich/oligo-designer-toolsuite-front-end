import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { Card } from "react-bootstrap";
import { ToolTip } from "../ui/Tooltip";
import { spaceBeforeCapitalLetters } from "./utils";

/**
 * Layout for a schema toggled by an "enabled" boolean, e.g. an optional filter.
 * Renders the name and the checkbox on a card header row, and any fields that only
 * exist while enabled stacked below it.
 *
 * @remarks
 * This component is used in `uiSchemaFromJsonSchemaRecursive`, applied to the option
 * schemas of a `oneOf` discriminated by `enabled` as well as to plain objects whose
 * only property is `enabled`, so both look the same.
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
        <Card
            style={{
                gridColumn: "1 / -1",
                backgroundColor: "var(--bs-primary-bg-subtle)",
            }}
        >
            <Card.Body>
                <div className="d-flex align-items-center gap-2">
                    <span className="super-label mb-0">
                        {spaceBeforeCapitalLetters(props.title)}
                    </span>
                    <ToolTip
                        id={props.fieldPathId.$id}
                        tip={props.description?.toString()}
                    />
                    <div className="flex-shrink-0 ms-auto">
                        {enabledProperty?.content}
                    </div>
                </div>
                {otherProperties.length > 0 && (
                    <div className="d-flex flex-column gap-2 mt-1">
                        {otherProperties.map((element) => (
                            <Fragment key={element.name}>
                                {element.content}
                            </Fragment>
                        ))}
                    </div>
                )}
            </Card.Body>
        </Card>
    );
});

export default EnabledToggleObjectTemplate;
