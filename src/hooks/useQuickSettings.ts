import { createContext, useContext } from "react";

/** Which group of the Quick Settings panel a field portals into. */
export type QuickSettingsGroup = "required" | "general";

/** The elements quick-setting fields portal themselves into, null before the panel mounts. */
export type QuickSettingsContainers = Record<
    QuickSettingsGroup,
    HTMLElement | null
>;

/** Gives quick-setting fields the Quick Settings panel's container elements. */
export const QuickSettingsContext = createContext<QuickSettingsContainers>({
    required: null,
    general: null,
});

/**
 * Gets the element that fields of a Quick Settings group portal into.
 *
 * @param group - the Quick Settings group
 * @returns The container element, or null before the panel mounts
 */
export const useQuickSettingsContainer = (group: QuickSettingsGroup) =>
    useContext(QuickSettingsContext)[group];
