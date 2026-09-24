import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, useState, type ComponentProps } from "react";
import { Accordion, Button } from "react-bootstrap";
import { isEmptySection, sectionKey } from "./utils";

/**
 * Layout for a single tab: an accordion of its sections, each rendered by a SectionLayout.
 *
 * @remarks
 * Applied in `uiSchemaFromJsonSchemaRecursive`. Owns which sections are open.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout a single tab
 */
function TabLayout(props: ObjectFieldTemplateProps) {
    // not memoized: RJSF rebuilds `properties` on every render, so a memo would never hit
    const sectionKeys = props.properties
        .filter((element) => !isEmptySection(props.uiSchema?.[element.name]))
        .map((element) => sectionKey(props.fieldPathId.$id, element.name));
    // only the first section starts open, so a tab opens as a short list of sections
    const [openSections, setOpenSections] = useState(sectionKeys.slice(0, 1));
    const allOpen =
        sectionKeys.length > 0 &&
        sectionKeys.every((key) => openSections.includes(key));

    // opening a section collapses the rest, closing one leaves the rest alone. Only
    // header clicks come through here, so "Expand all" can still open every section.
    const onSelect: ComponentProps<typeof Accordion>["onSelect"] = (key) => {
        const next = (key ?? []) as string[];
        const opened = next.find((section) => !openSections.includes(section));
        setOpenSections(opened ? [opened] : next);
    };

    return (
        <article>
            <div className="d-flex justify-content-end mb-2">
                <Button
                    variant="link"
                    size="sm"
                    className="text-decoration-none"
                    onClick={() => setOpenSections(allOpen ? [] : sectionKeys)}
                >
                    {allOpen ? "Collapse all" : "Expand all"}
                </Button>
            </div>
            <Accordion alwaysOpen activeKey={openSections} onSelect={onSelect}>
                {props.properties.map((element) => (
                    <Fragment key={element.name}>{element.content}</Fragment>
                ))}
            </Accordion>
        </article>
    );
}

export default TabLayout;
