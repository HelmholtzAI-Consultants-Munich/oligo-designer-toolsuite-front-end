import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";

const ObjectFieldTemplate = memo(function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    return (
        <div>
            <p>{props.title}</p>
            {props.properties.map((element) => (
                <>{element.content}</>
            ))}
        </div>
    );
});

export default ObjectFieldTemplate;
