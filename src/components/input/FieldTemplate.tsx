import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { FieldTemplateProps } from "@rjsf/utils";

const FieldTemplate = (props: FieldTemplateProps) => {
    const { id, label, children, rawDescription } = props;

    return (
        <div className="mt-3">
            <div className="d-flex align-items-center">
                <label htmlFor={id} className={"rjsf-label"}>
                    {label}
                </label>

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
            </div>
            {children}
        </div>
    );
};

export default FieldTemplate;
