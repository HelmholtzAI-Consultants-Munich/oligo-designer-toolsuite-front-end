import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { ToolTip } from "../ui/Tooltip";
import { spaceBeforeCapitalLetters } from "./utils";

/**
 * This ObjectFieldTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of object fields with ODT's design system.
 * It also introduces a CSS grid layout to automatically arrange input fields in a responsive way.
 */
const ObjectFieldTemplate = memo(function ObjectFieldTemplate(
    props: ObjectFieldTemplateProps
) {
    const { title, properties, description, fieldPathId } = props;

    return (
        <div style={{ gridColumn: "1 / -1" }}>
            {title && (
                <span className="super-label">
                    {spaceBeforeCapitalLetters(title)}
                </span>
            )}
            {description ? (
                <ToolTip id={fieldPathId.$id} tip={description.toString()} />
            ) : null}
            <div
                className="d-grid row-gap-5 column-gap-3"
                style={{
                    gridTemplateColumns:
                        "repeat(auto-fill, minmax(250px, 1fr))",
                }}
            >
                {properties.map((element) => (
                    <Fragment key={element.name}>{element.content}</Fragment>
                ))}
            </div>
        </div>
    );
});

export default ObjectFieldTemplate;
