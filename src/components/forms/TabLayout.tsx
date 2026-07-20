import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";

/**
 *  Layout for a single tab, containing multiple fields or sections
 *
 * @remarks
 * This component is used in the function `uiSchemaFromJsonSchemaRecursive`, which generates the uiSchema based on the JSON Schema
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout a single tab
 */
const TabLayout = memo(function TabLayout(props: ObjectFieldTemplateProps) {
    return (
        <article>
            {props.properties.map((element) => (
                <Fragment key={element.name}>{element.content}</Fragment>
            ))}
        </article>
    );
});

export default TabLayout;
