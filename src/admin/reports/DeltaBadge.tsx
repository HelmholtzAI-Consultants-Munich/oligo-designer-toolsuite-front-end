import { Badge } from "react-bootstrap";

const DeltaBadge = ({
    delta,
    isRate = false,
}: {
    delta: number | null | undefined;
    isRate?: boolean;
}) => {
    if (delta == null)
        return (
            <Badge bg="secondary" className="ms-2">
                N/A
            </Badge>
        );
    const sign = delta > 0 ? "+" : "";
    return (
        <Badge
            bg={delta > 0 ? "success" : delta < 0 ? "danger" : "secondary"}
            className="ms-2"
        >
            {isRate
                ? `${sign}${(delta * 100).toFixed(1)}pp`
                : `${sign}${delta}`}
        </Badge>
    );
};

export default DeltaBadge;
