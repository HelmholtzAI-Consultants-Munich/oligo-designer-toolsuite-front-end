import { useState, type ReactNode } from "react";
import { QuickSettingsContext } from "../../hooks/useQuickSettings";

type Props = {
    children: ReactNode;
    title?: string;
};

/**
 * Renders the panel that holds the form's quick settings, followed by the rest of the form.
 *
 * @remarks
 * The panel only provides the container; the fields themselves stay where they are in the form
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
    const [container, setContainer] = useState<HTMLDivElement | null>(null);

    return (
        <QuickSettingsContext value={container}>
            <section className="quick-settings" aria-label={title}>
                <span className="super-label">{title}</span>
                <div className="quick-settings-fields" ref={setContainer} />
            </section>
            {children}
        </QuickSettingsContext>
    );
};

export default QuickSettingsPanel;
