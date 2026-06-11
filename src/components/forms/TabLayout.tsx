import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";

/* Layout for a single tab, containing multiple fields or sections */
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
