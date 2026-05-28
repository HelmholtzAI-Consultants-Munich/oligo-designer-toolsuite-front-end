interface PulseProps {
    color?: string;
    size?: number;
    paused?: boolean;
    title?: string;
}

function Pulse({ color, size, paused, title }: PulseProps) {
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

// Make paused version available without extra prop (Pulse and Pulse.Paused can be used just like bootstrap icons)
Pulse.Paused = function PausedPulse({
    color,
    size,
    title,
}: Omit<PulseProps, "paused">) {
    return <Pulse color={color} size={size} paused title={title} />;
};

export default Pulse;
