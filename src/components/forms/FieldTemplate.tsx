import { Form, OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { FieldTemplateProps } from "@rjsf/utils";
import { Vertical } from "../ui/Alignment";

const FieldTemplate = (props: FieldTemplateProps) => {
    const { id, label, children, rawDescription } = props;

    return (
        <Form.Label className="rjsf-label h-100 w-100">
            <Form.Group as={Vertical} align="stretch" fillHeight>
                <Vertical.Item grow>
                    {label}
                    {rawDescription && (
                        <OverlayTrigger
                            trigger={["focus", "hover"]}
                            placement="top"
                            overlay={
                                <Popover id={id}>
                                    <Popover.Body>
                                        {rawDescription}
                                    </Popover.Body>
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
        </Form.Label>
    );
};

export default FieldTemplate;
