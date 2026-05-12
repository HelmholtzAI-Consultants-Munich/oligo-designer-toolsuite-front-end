interface PulseProps {
    color?: string;
    size?: number;
    paused?: boolean;
    title?: string;
}

export default function Pulse({ color, size, paused, title }: PulseProps) {
    return (
        <div
            className="pulse"
            style={
                {
                    width: size,
                    height: size,
                    "--pulse-color": color,
                } as React.CSSProperties
            }
            title={title}
        >
            {!paused && <div className="pulse-outer"></div>}
            <div className={"pulse-inner" + (paused ? " paused" : "")}></div>
        </div>
    );
}
