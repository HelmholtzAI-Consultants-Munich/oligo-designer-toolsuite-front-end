import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo } from "react";
import { ToolTip } from "../ui/Tooltip";
import { COMPACT_GRID_COLUMNS, spaceBeforeCapitalLetters } from "./utils";

/**
 * This ObjectFieldTemplate is based on the react-bootstrap theme's template.
 * It harmonizes the layout and styling of object fields with ODT's design system.
 * It also introduces a CSS grid layout to automatically arrange input fields in a responsive way.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate
 */
const ObjectFieldTemplate = memo(function ObjectFieldTemplate(
    props: ObjectFieldTemplateProps
) {
    const { title, properties, description, fieldPathId, schema } = props;

    // object/array properties span the full row on their own (see FieldTemplate)
    const isScalarProperty = (name: string): boolean => {
        const property = schema.properties?.[name];
        return (
            !property ||
            typeof property === "boolean" ||
            (!property.$ref &&
                property.type !== "object" &&
                property.type !== "array")
        );
    };

    return (
        <div
            className="border rounded p-3 mb-3"
            style={{ gridColumn: "1 / -1" }}
        >
            {title && (
                <span className="super-label">
                    {spaceBeforeCapitalLetters(title)}
                </span>
            )}
            <ToolTip id={fieldPathId.$id} tip={description?.toString()} />
            <div
                className="d-grid row-gap-5 column-gap-3"
                style={{ gridTemplateColumns: COMPACT_GRID_COLUMNS }}
            >
                {properties.map((element) =>
                    isScalarProperty(element.name) ? (
                        <div key={element.name} className="compact-field-item">
                            {element.content}
                        </div>
                    ) : (
                        <Fragment key={element.name}>
                            {element.content}
                        </Fragment>
                    )
                )}
            </div>
        </div>
    );
});

export default ObjectFieldTemplate;
