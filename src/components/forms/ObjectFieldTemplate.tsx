import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import { ToolTip } from "../ui/Tooltip";
import CompactGrid from "./CompactGrid";
import { spaceBeforeCapitalLetters } from "./utils";

/**
 * This ObjectFieldTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of object fields with ODT's design system.
 * It also introduces a CSS grid layout to automatically arrange input fields in a responsive way.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate
 */
const ObjectFieldTemplate = memo(function ObjectFieldTemplate(
    props: ObjectFieldTemplateProps
) {
    const { title, properties, description, fieldPathId, schema } = props;

    return (
        <div className="field-group-box">
            {title && (
                <span className="super-label">
                    {spaceBeforeCapitalLetters(title)}
                </span>
            )}
            <ToolTip id={fieldPathId.$id} tip={description?.toString()} />
            <CompactGrid
                schema={schema}
                properties={properties}
                uiSchema={props.uiSchema}
                className="row-gap-3"
            />
        </div>
    );
});

export default ObjectFieldTemplate;
