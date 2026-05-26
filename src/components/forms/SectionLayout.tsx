import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import { spaceBeforeCapitalLetters } from "./utils";

const SectionLayout = memo(function SectionLayout(props: ObjectFieldTemplateProps) {
    return (
        <section className="form-section">
                <div className="form-section-header">
                    <h5>{spaceBeforeCapitalLetters(props.title)}</h5>
                    <p>{props.description}</p>
                </div>
                <div>
                    {props.properties.map((element) => (
                        <>{element.content}</>
                    ))}
                </div>
        </section>
    );
});

export default SectionLayout;
