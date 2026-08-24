import { Check, X } from "react-bootstrap-icons";
import { defaultNodeWidth, offset } from "./constants";

export const formatParameterValue = (value: unknown): React.ReactNode => {
    if (value == "True") {
        return (
            <Check style={{ width: "1rem", height: "1rem", color: "green" }} />
        );
    } else if (value == "False") {
        return <X style={{ width: "1rem", height: "1rem", color: "red" }} />;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return Object.entries(value).map(([key, value]) => (
            <div key={key}>
                <span className="fw-semibold me-2">{key}:</span>
                <span className="text-muted">
                    {formatParameterValue(value)}
                </span>
            </div>
        ));
    }
    return String(value);
};

export const getNewId = (id: string) => (parseInt(id) + 1).toString();

export const getNewPosition = (xPosition: number) =>
    xPosition + defaultNodeWidth + offset;
