import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import CompactGrid from "./CompactGrid";
import GroupHeading from "./GroupHeading";

/**
 * Layout for a nested object of only scalar fields (e.g. per-base thresholds), each of
 * which needs no more than a small box.
 *
 * @remarks
 * Applied in `uiSchemaFromJsonSchemaRecursive` to any nested object whose properties are all scalar.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that lays out a small group of scalar fields compactly
 */
const CompactFieldGroupTemplate = memo(function CompactFieldGroupTemplate(
    props: ObjectFieldTemplateProps
) {
    return (
        <div className="field-group-box">
            <GroupHeading
                id={props.fieldPathId.$id}
                title={props.title}
                description={props.description}
            />
            <CompactGrid
                schema={props.schema}
                properties={props.properties}
                uiSchema={props.uiSchema}
                className="row-gap-2"
            />
        </div>
    );
});

export default CompactFieldGroupTemplate;
