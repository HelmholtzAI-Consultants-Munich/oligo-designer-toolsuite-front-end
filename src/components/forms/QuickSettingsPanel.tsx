import { useMemo, useState, type ReactNode } from "react";
import { QuickSettingsContext } from "../../hooks/useQuickSettings";
import { ToolTip } from "../ui/Tooltip";

type Props = {
    children: ReactNode;
    title?: string;
    /** `required_parameters`' own description: its fields portal in here, its section does not */
    requiredDescription?: string;
};

// the panel has no model field of its own to carry a description, so it is written here
const QUICK_SETTINGS_DESCRIPTION =
    "Most important parameters to set for this section.";

/**
 * Heads one tab with its quick settings, followed by the rest of that tab.
 *
 * @remarks
 * The panels only provide the containers; the fields stay where they are in the form and
 * portal their markup in here (see `FieldTemplate`), so their data binding is untouched.
 * CSS hides a panel whose container is empty, which is what keeps the required one off
 * every tab but the first.
 *
 * @param children - the rest of the tab, rendered below the panels
 * @param title - heading shown above the tunable settings
 * @returns A React Component that heads a tab with its quick settings
 */
const QuickSettingsPanel = ({
    children,
    title = "Quick Settings",
    requiredDescription,
}: Props) => {
    // state rather than a ref: a ref is only populated after the fields have rendered and
    // already read the container as null, so nothing would portal into it
    const [required, setRequired] = useState<HTMLDivElement | null>(null);
    const [general, setGeneral] = useState<HTMLDivElement | null>(null);
    const containers = useMemo(
        () => ({ required, general }),
        [required, general]
    );

    return (
        <QuickSettingsContext value={containers}>
            {/* only the first tab fills this one: that is where TabsLayout mounts the
                required-parameters section */}
            <section
                className="quick-settings"
                aria-label="Required Parameters"
            >
                <span className="super-label">Required Parameters</span>
                <ToolTip id="required-parameters" tip={requiredDescription} />
                <div className="quick-settings-fields" ref={setRequired} />
            </section>
            <section className="quick-settings" aria-label={title}>
                <span className="super-label">{title}</span>
                <ToolTip id="quick-settings" tip={QUICK_SETTINGS_DESCRIPTION} />
                <div className="quick-settings-fields" ref={setGeneral} />
            </section>
            {children}
        </QuickSettingsContext>
    );
};

export default QuickSettingsPanel;
