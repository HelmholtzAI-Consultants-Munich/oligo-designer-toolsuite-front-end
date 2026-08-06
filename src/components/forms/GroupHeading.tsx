import { memo, type ReactNode } from "react";
import { ToolTip } from "../ui/Tooltip";
import { spaceBeforeCapitalLetters } from "./utils";

interface GroupHeadingProps {
    id: string;
    title?: string;
    description?: ReactNode;
    className?: string;
}

/**
 * A field group's name, with its description as a tooltip beside it.
 *
 * @param props - the group's `fieldPathId.$id`, title, description and extra classes
 * @returns A React Component that heads a field group, or null if there is nothing to show
 */
const GroupHeading = memo(function GroupHeading({
    id,
    title,
    description,
    className = "",
}: GroupHeadingProps) {
    if (!title && !description) {
        return null;
    }

    return (
        <div className={`group-heading d-flex align-items-center ${className}`}>
            {title && (
                <span className="super-label">
                    {spaceBeforeCapitalLetters(title)}
                </span>
            )}
            <ToolTip id={id} tip={description?.toString()} />
        </div>
    );
});

export default GroupHeading;
