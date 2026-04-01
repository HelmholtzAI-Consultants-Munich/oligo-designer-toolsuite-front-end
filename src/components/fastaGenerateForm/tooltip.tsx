import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";

interface ToolTipProps {
    id: string;
    tip: string;
}

export const ToolTip: React.FC<ToolTipProps> = ({ id, tip }) => {
    if (tip === "") return;
    return (
        <OverlayTrigger
            trigger={["hover", "focus"]}
            placement="top"
            overlay={
                <Popover id={id}>
                    <Popover.Body>{tip}</Popover.Body>
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
    );
};
