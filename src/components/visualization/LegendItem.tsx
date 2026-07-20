import { Horizontal } from "../ui/Alignment";

/**
 * Dispays a colored square and label corresponding to an element in the current visualization.
 *
 * @param color - The color to display in the square.
 * @param label - The text label to display next to the square.
 * @returns A React component representing a legend item.
 */
export const LegendItem: React.FC<{ color: string; label: string }> = ({
    color,
    label,
}) => {
    return (
        <Horizontal gap="sm" align="baseline">
            <span
                style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    backgroundColor: color,
                    marginRight: "5px",
                }}
            ></span>
            {label}
        </Horizontal>
    );
};
