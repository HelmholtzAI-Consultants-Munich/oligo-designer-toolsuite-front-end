import { createContext, useContext } from "react";

/** The element quick-setting fields portal themselves into, or null before the panel mounts. */
export const QuickSettingsContext = createContext<HTMLElement | null>(null);

export const useQuickSettingsContainer = () => {
    return useContext(QuickSettingsContext);
};
