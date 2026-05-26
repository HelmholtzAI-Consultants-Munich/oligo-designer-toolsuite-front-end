import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";

const TabLayout = memo(function TabLayout(props: ObjectFieldTemplateProps) {
    return (
        <article>
            {props.properties.map((element) => (
                <>{element.content}</>
            ))}
        </article>
    );
});

export default TabLayout;
