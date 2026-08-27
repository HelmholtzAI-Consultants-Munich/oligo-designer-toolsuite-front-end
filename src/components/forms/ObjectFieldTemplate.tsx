import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import CompactGrid from "./CompactGrid";
import GroupHeading from "./GroupHeading";

// RJSF never passes className; only CompactFieldGroupTemplate does, for a tighter row gap
type Props = ObjectFieldTemplateProps & {
    className?: string;
};

/**
 * This ObjectFieldTemplate is based on the react-bootstrap theme's template.
 * It draws an object's fields as a named box laid out on the form's compact grid.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate
 */
const ObjectFieldTemplate = memo(function ObjectFieldTemplate({
    className = "row-gap-3",
    ...props
}: Props) {
    return (
        <div className="field-group-box">
            <GroupHeading
                id={props.fieldPathId.$id}
                title={props.title}
                description={props.description}
            />
            <CompactGrid {...props} className={className} />
        </div>
    );
});

export default ObjectFieldTemplate;
