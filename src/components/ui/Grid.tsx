type GapSize = "" | "xs" | "sm" | "md" | "lg" | "xl";
type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly" | "stretch";

const gapValues: Record<GapSize, string> = {
    "": "0",
    "xs": "1",
    "sm": "2",
    "md": "3",
    "lg": "4",
    "xl": "5"
};

interface HorizontalProps {
    wrap?: boolean;
    gap?: GapSize;
    align?: Align;
    justify?: Justify;
    className?: string;
    children: React.ReactNode;
}

function Horizontal({ wrap = false, gap, align = "start", justify = "start", className = "", children }: HorizontalProps) {
    return (
        <div
            style={{
                display: "flex",
                flexWrap: wrap ? "wrap" : "nowrap",
                alignItems: align,
                justifyContent: justify,
                width: ["stretch", "center", "end", "space-between", "space-around", "space-evenly"].includes(justify) ? "100%" : undefined,
                height: ["stretch", "center", "end"].includes(align) ? "100%" : undefined,
            }}
            className={className + ` gap-${gapValues[gap || ""]}`}
        >
            {children}
        </div>
    )
}

interface VerticalProps {
    gap?: GapSize;
    align?: Align;
    justify?: Justify;
    className?: string;
    children: React.ReactNode;
}

function Vertical({ gap, align = "start", justify = "start", className = "", children }: VerticalProps) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                flexWrap: "nowrap",
                alignItems: align,
                justifyContent: justify,
                height: ["stretch", "center", "end", "space-between", "space-around", "space-evenly"].includes(justify) ? "100%" : undefined,
                width: ["stretch", "center", "end"].includes(align) ? "100%" : undefined,
            }}
            className={className + ` gap-${gapValues[gap || ""]}`}
        >
            {children}
        </div>
    )
}

interface GridProps {
    gap?: GapSize | { row?: GapSize; column?: GapSize };
    itemWidth?: number | string;
    className?: string;
    children: React.ReactNode;

}

function Grid({ gap, itemWidth, className = "", children }: GridProps) {
    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                rowGap: typeof gap === "object" ? gap.row : gap,
                columnGap: typeof gap === "object" ? gap.column : gap,
                width: itemWidth
            }}
            className={className}
        >
            {children}
        </div>
    )
}

interface FlexItemProps {
    selfAlign?: Align;
    grow?: number | boolean;
    children: React.ReactNode;
}

function FlexItem({ selfAlign, grow, children }: FlexItemProps) {
    return (
        <div
            style={{
                alignSelf: selfAlign,
                flexGrow: grow === true ? 1 : typeof grow === "number" ? grow : 0
            }}
        >
            {children}
        </div>
    )
}

interface GridItemProps {
    children: React.ReactNode;
}

function GridItem({ children }: GridItemProps) {
    return (
        <div>
            {children}
        </div>
    )
}

Vertical.Item = FlexItem;
Horizontal.Item = FlexItem;
Grid.Item = GridItem;

export { Grid, Horizontal, Vertical };
