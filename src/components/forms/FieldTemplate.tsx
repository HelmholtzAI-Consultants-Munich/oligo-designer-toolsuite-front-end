import { Form, OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { FieldTemplateProps } from "@rjsf/utils";
import { Vertical } from "../ui/Alignment";

const FieldTemplate = (props: FieldTemplateProps) => {
    const { id, label, children, rawDescription, fieldPathId } = props;

    const isRoot = fieldPathId.$id === "root";
    if (isRoot) return <>{children}</>;

    return (
        <Form.Group as={Vertical} align="stretch" fillHeight>
            <Vertical.Item grow>
                <Form.Label htmlFor={id}>{label}</Form.Label>
                {rawDescription && (
                    <OverlayTrigger
                        trigger={["focus", "hover"]}
                        placement="top"
                        overlay={
                            <Popover id={id}>
                                <Popover.Body>{rawDescription}</Popover.Body>
                            </Popover>
                        }
                    >
                        <InfoCircle
                            style={{
                                fontSize: "1rem",
                                cursor: "pointer",
                                color: "var(--bs-text-muted)",
                                marginLeft: "10px",
                            }}
                        />
                    </OverlayTrigger>
                )}
            </Vertical.Item>
            {children}
        </Form.Group>
    );
};

export default FieldTemplate;
