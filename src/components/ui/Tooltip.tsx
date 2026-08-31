import { useMemo } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import type { OverlayTriggerType } from "react-bootstrap/esm/OverlayTrigger";

interface ToolTipProps {
    /** id of the field being described, used to derive the popover's and the description's own ids */
    id: string;
    tip: string | undefined;
    /**
     * Renders the trigger as a span rather than a button, for the one place a button cannot go:
     * inside another button, as an accordion header is. The hidden description below sits in
     * that button's accessible name instead, so the tip is still announced.
     */
    presentational?: boolean;
}

/**
 * Renders an info icon that reveals `tip` on hover or focus.
 *
 * @remarks
 * The tip is also written to a visually hidden element at `<id>__description`, the id RJSF
 * puts in every field's `aria-describedby`. Without it a screen reader resolves nothing,
 * since the popover only exists while open.
 *
 * @param id - id of the described field
 * @param tip - the description to show, or nothing to render no icon at all
 * @returns A React Component showing a description on hover, focus, or to a screen reader
 */
export const ToolTip: React.FC<ToolTipProps> = ({
    id,
    tip,
    presentational,
}) => {
    const triggerArray = useMemo<OverlayTriggerType[]>(
        () => (presentational ? ["hover"] : ["hover", "focus"]),
        [presentational]
    );

    if (!tip) {
        return null;
    }

    return (
        <>
            <span id={`${id}__description`} className="visually-hidden">
                {tip}
            </span>
            <OverlayTrigger
                trigger={triggerArray}
                placement="top"
                overlay={
                    <Popover id={`${id}__tooltip`}>
                        <Popover.Body>{tip}</Popover.Body>
                    </Popover>
                }
            >
                {/* a button rather than the bare icon, so that the tip is reachable by keyboard
                    and announced: an svg is neither focusable nor nameable, which also left the
                    "focus" trigger above with nothing to fire on */}
                {presentational ? (
                    <span className="tooltip-trigger" aria-hidden="true">
                        <InfoCircle />
                    </span>
                ) : (
                    <button
                        type="button"
                        className="tooltip-trigger"
                        aria-label="More information"
                    >
                        <InfoCircle aria-hidden="true" />
                    </button>
                )}
            </OverlayTrigger>
        </>
    );
};
