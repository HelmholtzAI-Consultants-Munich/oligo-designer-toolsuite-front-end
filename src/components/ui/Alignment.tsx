type GapSize = "" | "xs" | "sm" | "md" | "lg" | "xl";
type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify =
    | "start"
    | "center"
    | "end"
    | "space-between"
    | "space-around"
    | "space-evenly"
    | "stretch";

const gapValues: Record<GapSize, string> = {
    "": "0",
    xs: "1",
    sm: "2",
    md: "3",
    lg: "4",
    xl: "5",
};

interface HorizontalProps {
    wrap?: boolean;
    gap?: GapSize;
    align?: Align;
    justify?: Justify;
    fillWidth?: boolean;
    fillHeight?: boolean;
    grow?: boolean;
    className?: string;
    children: React.ReactNode;
}

function Horizontal({
    wrap = false,
    gap = "",
    align = "start",
    justify = "start",
    fillWidth = false,
    fillHeight = false,
    grow = false,
    className = "",
    children,
}: HorizontalProps) {
    return (
        <div
            style={{
                flexWrap: wrap ? "wrap" : "nowrap",
                alignItems: align,
                justifyContent: justify,
                width: fillWidth ? "100%" : undefined,
                height: fillHeight ? "100%" : undefined,
                flexGrow: grow ? 1 : undefined,
                minWidth: 0, // Prevent overflow when used inside flex containers
            }}
            className={className + ` horizontal d-flex gap-${gapValues[gap]}`}
        >
            {children}
        </div>
    );
}

interface VerticalProps {
    gap?: GapSize;
    align?: Align;
    justify?: Justify;
    fillWidth?: boolean;
    fillHeight?: boolean;
    grow?: boolean;
    className?: string;
    children: React.ReactNode;
}

function Vertical({
    gap = "",
    align = "start",
    justify = "start",
    fillWidth = false,
    fillHeight = false,
    grow = false,
    className = "",
    children,
}: VerticalProps) {
    return (
        <div
            style={{
                flexWrap: "nowrap",
                alignItems: align,
                justifyContent: justify,
                width: fillWidth ? "100%" : undefined,
                height: fillHeight ? "100%" : undefined,
                flexGrow: grow ? 1 : undefined,
                minWidth: 0, // Prevent overflow when used inside flex containers
            }}
            className={
                className + ` vertical d-flex flex-column gap-${gapValues[gap]}`
            }
        >
            {children}
        </div>
    );
}

interface FlexItemProps {
    selfAlign?: Align;
    grow?: number | boolean;
    fillWidth?: boolean;
    fillHeight?: boolean;
    className?: string;
    children: React.ReactNode;
}

function FlexItem({
    selfAlign,
    grow,
    fillWidth,
    fillHeight,
    className,
    children,
}: FlexItemProps) {
    return (
        <div
            style={{
                alignSelf: selfAlign,
                flexGrow:
                    grow === true
                        ? 1
                        : typeof grow === "number"
                          ? grow
                          : undefined,
                flexBasis: 0,
                width: fillWidth ? "100%" : undefined,
                height: fillHeight ? "100%" : undefined,
            }}
            className={className}
        >
            {children}
        </div>
    );
}

interface GridProps {
    gap?: GapSize | { row: GapSize; column: GapSize };
    itemWidth?: number | string;
    className?: string;
    children: React.ReactNode;
}

function Grid({ gap = "", itemWidth, className = "", children }: GridProps) {
    let gapClass = "";
    if (typeof gap === "string") {
        gapClass = `gap-${gapValues[gap]}`;
    } else {
        gapClass = `row-gap-${gapValues[gap.row]} column-gap-${gapValues[gap.column]}`;
    }

    return (
        <div
            style={{
                display: "grid",
                gridAutoColumns: !itemWidth ? "minmax(0, 1fr)" : undefined,
                gridAutoFlow: !itemWidth ? "column" : undefined,
                gridTemplateColumns: itemWidth
                    ? `repeat(auto-fit, minmax(min(${typeof itemWidth === "number" ? `${itemWidth}px` : itemWidth}, 100%), 1fr))`
                    : undefined,
            }}
            className={className + " " + gapClass}
        >
            {children}
        </div>
    );
}

interface GridItemProps {
    children: React.ReactNode;
}

function GridItem({ children }: GridItemProps) {
    return <div>{children}</div>;
}

Vertical.Item = FlexItem;
Horizontal.Item = FlexItem;
Grid.Item = GridItem;

export { Grid, Horizontal, Vertical };
