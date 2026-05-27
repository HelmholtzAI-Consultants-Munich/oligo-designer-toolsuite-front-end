import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";

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
