interface PulseProps {
    color?: string;
    size?: number;
    paused?: boolean;
}

export default function Pulse({ color, size, paused }: PulseProps) {
    return (
        <div className="pulse" style={{ width: size, height: size, "--pulse-color": color } as React.CSSProperties}>
            {!paused && (
                <div className="pulse-outer"></div>
            )}
            <div className="pulse-inner"></div>
        </div>
    );
}
