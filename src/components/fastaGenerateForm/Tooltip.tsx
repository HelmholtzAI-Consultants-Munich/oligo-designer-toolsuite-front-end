import { useMemo } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { OverlayTriggerType } from "react-bootstrap/esm/OverlayTrigger";

interface ToolTipProps {
    id: string;
    tip: string;
}

export const ToolTip: React.FC<ToolTipProps> = ({ id, tip }) => {
    const triggerArray = useMemo<OverlayTriggerType[]>(
        () => ["hover", "focus"],
        []
    );
    if (tip === "") return;
    return (
        <OverlayTrigger
            trigger={triggerArray}
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
