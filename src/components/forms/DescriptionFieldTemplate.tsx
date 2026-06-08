import type { DescriptionFieldProps } from "@rjsf/utils";
import { memo } from "react";

/**
 * This DescriptionFieldTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the styling of field descriptions with ODT's design system and removes unncessary div wrappers.
 */
const DescriptionFieldTemplate = memo(function DescriptionFieldTemplate(
    props: DescriptionFieldProps
) {
    const { description, id } = props;
    return (
        <span id={id} className="text-sm text-muted">
            {description}
        </span>
    );
});

export default DescriptionFieldTemplate;
