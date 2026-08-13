import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import ObjectFieldTemplate from "./ObjectFieldTemplate";

/**
 * Layout for a nested object of only scalar fields (e.g. per-base thresholds), each of
 * which needs no more than a small box: the default group box, packed tighter.
 *
 * @remarks
 * Applied in `uiSchemaFromJsonSchemaRecursive` to any nested object whose properties are all scalar.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that lays out a small group of scalar fields compactly
 */
const CompactFieldGroupTemplate = (props: ObjectFieldTemplateProps) => (
    <ObjectFieldTemplate {...props} className="row-gap-2" />
);

export default CompactFieldGroupTemplate;
