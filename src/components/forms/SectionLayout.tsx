import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { spaceBeforeCapitalLetters } from "./utils";

const SectionLayout = memo(function SectionLayout(
    props: ObjectFieldTemplateProps
) {
    return (
        <section className="form-section">
            <div className="form-section-header">
                <h5>{spaceBeforeCapitalLetters(props.title)}</h5>
                <p>{props.description}</p>
            </div>
            <div
                className="d-grid row-gap-4 column-gap-3"
                style={{
                    gridTemplateColumns:
                        "repeat(auto-fill, minmax(250px, 1fr))",
                }}
            >
                {props.properties.map((element) => (
                    <Fragment key={element.name}>{element.content}</Fragment>
                ))}
            </div>
        </section>
    );
});

export default SectionLayout;
