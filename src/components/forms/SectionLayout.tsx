import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { spaceBeforeCapitalLetters } from "./utils";

/**
 * Layout for a section within a tab, sections are separated by vertical lines
 *
 * @remarks
 * This component is used in the function `uiSchemaFromJsonSchemaRecursive`, which generates the uiSchema based on the JSON Schema
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout a section within a tab
 */
const SectionLayout = memo(function SectionLayout(
    props: ObjectFieldTemplateProps
) {
    return (
        <section className="form-section">
            <div className="form-section-header">
                <h5>{spaceBeforeCapitalLetters(props.title)}</h5>
                {props.description && <p>{props.description}</p>}
            </div>
            <div
                className="d-grid row-gap-4 column-gap-3"
                style={{
                    gridTemplateColumns:
                        "repeat(auto-fill, minmax(250px, 1fr))",
                }}
            >
                {props.properties.map((element) => (
                    <Fragment key={element.name}>{element.content}</Fragment>
                ))}
            </div>
        </section>
    );
});

export default SectionLayout;
