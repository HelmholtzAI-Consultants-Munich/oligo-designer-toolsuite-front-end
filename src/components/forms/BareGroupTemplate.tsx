import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import CompactGrid from "./CompactGrid";

/**
 * Layout for a field group that is already named by whatever holds it: just its fields.
 *
 * @remarks
 * Applied in `uiSchemaFromJsonSchemaRecursive` to the options of a discriminated union whose
 * selector already names the choice, so a heading here would only repeat it.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component holding the group's fields, with no heading or box of its own
 */
const BareGroupTemplate = memo(function BareGroupTemplate(
    props: ObjectFieldTemplateProps
) {
    return <CompactGrid {...props} className="row-gap-2" />;
});

export default BareGroupTemplate;
