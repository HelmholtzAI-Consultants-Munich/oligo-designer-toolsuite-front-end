import type { WidgetProps } from "@rjsf/utils";
import { Widgets } from "@rjsf/react-bootstrap";
import FieldRowLabel from "./FieldRowLabel";

const { SelectWidget } = Widgets;

/**
 * The WrappedSelectWidget wraps the theme's SelectWidget with the same name-and-tooltip row
 * every other input gets from `WrappedBaseInputTemplate`, which a select does not go through.
 *
 * @remarks
 * Only a required enum needs this: an optional one (`anyOf` against null) is labelled by
 * `WrappedAnyOfField`, and a union's own option selector asks for its label to be hidden.
 * Not wrapped in `memo`: RJSF resolves widgets through `getWidget`, which rejects one.
 *
 * @param props - WidgetProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields/#the-widgetprops-object})
 * @returns A React Component that is used to overwrite the theme's `SelectWidget`
 */
const WrappedSelectWidget = (props: WidgetProps) => {
    const { id, label, hideLabel, schema } = props;
    // a union's option selector is named by the section or card holding it, and RJSF asks for
    // it by this id rather than through `hideLabel`
    const isOptionSelector = /__(one|any)of_select$/.test(id);
    const showLabel =
        !hideLabel && !isOptionSelector && !!(label || schema.description);

    return (
        <div className="field-row">
            {showLabel && (
                <FieldRowLabel
                    id={id}
                    label={label}
                    description={schema.description}
                />
            )}
            <div className="field-row-control">
                <SelectWidget {...props} />
            </div>
        </div>
    );
};

export default WrappedSelectWidget;
