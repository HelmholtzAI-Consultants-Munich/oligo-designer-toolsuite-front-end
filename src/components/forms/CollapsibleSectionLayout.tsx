import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo, useState } from "react";
import { Button, Collapse } from "react-bootstrap";
import { ChevronDown, ChevronUp } from "react-bootstrap-icons";
import { ToolTip } from "../ui/Tooltip";
import { COMPACT_GRID_COLUMNS, spaceBeforeCapitalLetters } from "./utils";

/**
 * Layout for a section within a tab, rendered collapsed by default with a toggle to expand it.
 *
 * @remarks
 * This component is used in `uiSchemaFromJsonSchemaRecursive`, applied to fields whose schema
 * carries the `x-collapsed` flag (set via `json_schema_extra` on the backend Pydantic model).
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that lays out a section within a tab behind a collapse toggle
 */
const CollapsibleSectionLayout = memo(function CollapsibleSectionLayout(
    props: ObjectFieldTemplateProps
) {
    const [open, setOpen] = useState(false);
    const controlsId = `collapsible-section-${props.fieldPathId.$id}`;

    return (
        <div style={{ gridColumn: "1 / -1" }}>
            <div className="d-flex align-items-center justify-content-between">
                <span>
                    <span className="super-label">
                        {spaceBeforeCapitalLetters(props.title)}
                    </span>
                    {props.description && (
                        <ToolTip
                            id={props.fieldPathId.$id}
                            tip={props.description.toString()}
                        />
                    )}
                </span>
                <Button
                    variant="link"
                    aria-controls={controlsId}
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                >
                    {open ? <ChevronUp /> : <ChevronDown />}
                </Button>
            </div>
            <Collapse in={open}>
                <div id={controlsId}>
                    <div
                        className="d-grid row-gap-2 column-gap-3"
                        style={{ gridTemplateColumns: COMPACT_GRID_COLUMNS }}
                    >
                        {props.properties.map((element) => (
                            <div
                                key={element.name}
                                className="compact-field-item"
                            >
                                {element.content}
                            </div>
                        ))}
                    </div>
                </div>
            </Collapse>
        </div>
    );
});

export default CollapsibleSectionLayout;
