import { useMemo, useState, type ReactNode } from "react";
import { QuickSettingsContext } from "../../hooks/useQuickSettings";

type Props = {
    children: ReactNode;
    title?: string;
};

/**
 * Renders the panel that holds the form's quick settings, followed by the rest of the form.
 *
 * @remarks
 * The panel only provides the containers; the fields themselves stay where they are in the form
 * and portal their markup in here (see `FieldTemplate`), so their data binding is untouched.
 * CSS hides the panel while the container is empty.
 *
 * @param children - the rest of the form, rendered below the panel
 * @param title - heading shown above the fields
 * @returns A React Component that heads the form with its quick settings
 */
const QuickSettingsPanel = ({ children, title = "Quick Settings" }: Props) => {
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
            <section className="quick-settings" aria-label={title}>
                <span className="super-label">{title}</span>
                {/* the inputs a run cannot start without, ruled off from the rest */}
                <div
                    className="quick-settings-fields quick-settings-required"
                    ref={setRequired}
                />
                <div className="quick-settings-fields" ref={setGeneral} />
            </section>
            {children}
        </QuickSettingsContext>
    );
};

export default QuickSettingsPanel;
