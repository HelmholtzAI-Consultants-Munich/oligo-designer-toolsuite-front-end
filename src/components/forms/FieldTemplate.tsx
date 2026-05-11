import { Form, OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { FieldTemplateProps } from "@rjsf/utils";
import { Vertical } from "../ui/Alignment";
import { isRootField } from "./utils";
import { ToolTip } from "../ui/Tooltip";

const FieldTemplate = (props: FieldTemplateProps) => {
    const { id, label, children, rawDescription, fieldPathId } = props;

    const isRoot = isRootField(fieldPathId);
    if (isRoot) return <>{children}</>;

    return (
        <Form.Group as={Vertical} align="stretch" fillHeight>
            <Vertical.Item grow>
                <Form.Label htmlFor={id}>{label}</Form.Label>
                <ToolTip id={id} tip={rawDescription} />
            </Vertical.Item>
            {children}
        </Form.Group>
    );
};

export default FieldTemplate;
