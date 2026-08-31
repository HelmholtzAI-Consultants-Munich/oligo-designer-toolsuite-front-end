import { createContext, useContext } from "react";

/** Which group of the Quick Settings panel a field portals into. */
export type QuickSettingsGroup = "required" | "general";

/** The elements quick-setting fields portal themselves into, null before the panel mounts. */
export type QuickSettingsContainers = Record<
    QuickSettingsGroup,
    HTMLElement | null
>;

export const QuickSettingsContext = createContext<QuickSettingsContainers>({
    required: null,
    general: null,
});

export const useQuickSettingsContainer = (group: QuickSettingsGroup) =>
    useContext(QuickSettingsContext)[group];
