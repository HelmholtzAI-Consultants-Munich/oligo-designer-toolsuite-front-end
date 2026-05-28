import type { DescriptionFieldProps } from "@rjsf/utils";
import { memo } from "react";

const DescriptionFieldTemplate = memo(function DescriptionFieldTemplate(props: DescriptionFieldProps) {
    const { description, id } = props;
    return (
        <span id={id} className="text-sm text-muted">{description}</span>
    );
})

export default DescriptionFieldTemplate;
