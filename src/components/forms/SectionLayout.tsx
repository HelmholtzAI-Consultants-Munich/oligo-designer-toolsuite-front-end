import { getUiOptions, type ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo, useState } from "react";
import { Collapse } from "react-bootstrap";
import { ChevronDown, ChevronUp } from "react-bootstrap-icons";
import { ToolTip } from "../ui/Tooltip";
import CompactGrid from "./CompactGrid";
import { spaceBeforeCapitalLetters } from "./utils";

/**
 * Layout for a section within a tab, collapsible so a long form stays scannable.
 *
 * @remarks
 * This component is used in the function `uiSchemaFromJsonSchemaRecursive`, which generates the uiSchema based on the JSON Schema.
 * `ui:options.defaultOpen` (set there) expands the section on first render.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout a section within a tab
 */
const SectionLayout = memo(function SectionLayout(
    props: ObjectFieldTemplateProps
) {
    const [open, setOpen] = useState(
        !!getUiOptions(props.uiSchema).defaultOpen
    );
    const contentId = `form-section-${props.fieldPathId.$id}`;

    return (
        <section className="form-section">
            <button
                type="button"
                className="form-section-header"
                aria-controls={contentId}
                aria-expanded={open}
                onClick={() => setOpen((isOpen) => !isOpen)}
            >
                <h5>{spaceBeforeCapitalLetters(props.title)}</h5>
                <ToolTip
                    id={props.fieldPathId.$id}
                    tip={props.description?.toString()}
                />
                <span className="ms-auto">
                    {open ? <ChevronUp /> : <ChevronDown />}
                </span>
            </button>
            <Collapse in={open}>
                <div id={contentId} className="form-section-body">
                    <CompactGrid
                        schema={props.schema}
                        properties={props.properties}
                        uiSchema={props.uiSchema}
                        className="row-gap-2"
                    />
                </div>
            </Collapse>
        </section>
    );
});

export default SectionLayout;
