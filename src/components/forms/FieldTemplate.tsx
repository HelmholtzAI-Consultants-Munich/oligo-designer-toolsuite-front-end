import { Form, OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { FieldTemplateProps } from "@rjsf/utils";

const FieldTemplate = (props: FieldTemplateProps) => {
    const { id, label, children, rawDescription } = props;

    return (
        <Form.Group controlId={id}>
            <Form.Label className="rjsf-label">
                {label}
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
                                fontSize: "1.2rem",
                                cursor: "pointer",
                                color: "#0d6efd",
                                marginLeft: "10px",
                            }}
                        />
                    </OverlayTrigger>
                )}
            </Form.Label>
            {children}
        </Form.Group>
    );
};

export default FieldTemplate;
