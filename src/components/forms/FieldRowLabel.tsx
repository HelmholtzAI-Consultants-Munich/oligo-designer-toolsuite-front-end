import { memo, type ReactNode } from "react";
import { Form } from "react-bootstrap";
import { ToolTip } from "../ui/Tooltip";

interface FieldRowLabelProps {
    id: string;
    label: ReactNode;
    description?: string;
}

/**
 * A field's label in the left column of a `field-row`, with its description as a tooltip beside it.
 *
 * @param props - the field's input id, label and description
 * @returns A React Component that labels a single field
 */
const FieldRowLabel = memo(function FieldRowLabel({
    id,
    label,
    description,
}: FieldRowLabelProps) {
    return (
        <div className="field-row-label">
            <Form.Label htmlFor={id} className="mb-0">
                {label}
            </Form.Label>
            {/* shares the input's id, so the tooltip's `<id>__description` matches its aria-describedby */}
            <ToolTip id={id} tip={description} />
        </div>
    );
});

export default FieldRowLabel;
