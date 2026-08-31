import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import { Accordion } from "react-bootstrap";
import CompactGrid from "./CompactGrid";
import { spaceBeforeCapitalLetters } from "./utils";
import { ToolTip } from "../ui/Tooltip";

/**
 * Layout for a section within a tab, rendered as one item of the tab's accordion.
 *
 * @remarks
 * Applied in `uiSchemaFromJsonSchemaRecursive`. `TabLayout` owns whether it is open.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout a section within a tab
 */
const SectionLayout = memo(function SectionLayout(
    props: ObjectFieldTemplateProps
) {
    return (
        <Accordion.Item
            eventKey={props.fieldPathId.$id}
            className="form-section"
        >
            <Accordion.Header>
                {/* the header is itself a button, so the tip cannot be one; its hidden text
                    lands in this button's accessible name, which is where it belongs anyway */}
                <span className="d-inline-flex align-items-center">
                    {spaceBeforeCapitalLetters(props.title)}
                    <ToolTip
                        id={props.fieldPathId.$id}
                        tip={props.description?.toString()}
                        presentational
                    />
                </span>
            </Accordion.Header>
            <Accordion.Body>
                <CompactGrid {...props} className="row-gap-2" />
            </Accordion.Body>
        </Accordion.Item>
    );
});

export default SectionLayout;
