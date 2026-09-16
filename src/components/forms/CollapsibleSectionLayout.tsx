import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo, useState } from "react";
import { Button, Collapse } from "react-bootstrap";
import { ChevronDown, ChevronUp } from "react-bootstrap-icons";
import CompactGrid from "./CompactGrid";
import GroupHeading from "./GroupHeading";

/**
 * Layout for a field group that starts collapsed behind a toggle.
 *
 * @remarks
 * Applied in `uiSchemaFromJsonSchemaRecursive` to fields carrying the backend's `x-collapsed` flag.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that lays out a field group behind a collapse toggle
 */
const CollapsibleSectionLayout = memo(function CollapsibleSectionLayout(
    props: ObjectFieldTemplateProps
) {
    const [open, setOpen] = useState(false);
    const controlsId = `collapsible-section-${props.fieldPathId.$id}`;

    return (
        <div className="field-group-box">
            <div className="d-flex align-items-center justify-content-between">
                <GroupHeading
                    id={props.fieldPathId.$id}
                    title={props.title}
                    description={props.description}
                    className="mb-0"
                />
                <Button
                    variant="link"
                    className="p-0 text-muted"
                    aria-controls={controlsId}
                    aria-expanded={open}
                    onClick={() => setOpen((isOpen) => !isOpen)}
                >
                    {open ? <ChevronUp /> : <ChevronDown />}
                </Button>
            </div>
            <Collapse in={open}>
                <div id={controlsId}>
                    <CompactGrid {...props} className="row-gap-2" />
                </div>
            </Collapse>
        </div>
    );
});

export default CollapsibleSectionLayout;
