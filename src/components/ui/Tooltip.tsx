import { useMemo } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { OverlayTriggerType } from "react-bootstrap/esm/OverlayTrigger";

interface ToolTipProps {
    id: string;
    tip: string | undefined;
}

export const ToolTip: React.FC<ToolTipProps> = ({ id, tip }) => {
    const triggerArray = useMemo<OverlayTriggerType[]>(
        () => ["hover", "focus"],
        []
    );

    return (
        tip &&
        tip != "" && (
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
                        fontSize: "1rem",
                        cursor: "pointer",
                        color: "var(--bs-text-muted)",
                        marginLeft: "10px",
                    }}
                />
            </OverlayTrigger>
        )
    );
};
