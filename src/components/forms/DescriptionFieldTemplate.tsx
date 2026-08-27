import type { DescriptionFieldProps } from "@rjsf/utils";
import { memo } from "react";
import { ToolTip } from "../ui/Tooltip";

/**
 * This DescriptionFieldTemplate is based on the react-bootstrap theme's template.
 * It renders descriptions as a tooltip, so widgets falling back to it (e.g. the
 * checkbox widget) match the rest of the form.
 *
 * @param props - DescriptionFieldProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#descriptionfieldtemplate})
 * @returns A React Component that is used to overwrite the default DescriptionFieldTemplate
 */
const DescriptionFieldTemplate = memo(function DescriptionFieldTemplate(
    props: DescriptionFieldProps
) {
    const { description, id } = props;
    return <ToolTip id={id} tip={description?.toString()} />;
});

export default DescriptionFieldTemplate;
