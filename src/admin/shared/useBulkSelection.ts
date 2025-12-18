import { useState, useCallback } from "react";

/**
 * Custom hook for managing bulk selection state
 * Provides reusable selection state management logic for tables with checkboxes
 */
export const useBulkSelection = () => {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isSelectAll, setIsSelectAll] = useState(false);

    const handleSelectItem = useCallback((itemId: string) => {
        setSelectedItems((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            setIsSelectAll(false); // Reset select all when manually selecting
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(
        (allItemIds: string[]) => {
            if (isSelectAll || selectedItems.size > 0) {
                // Deselect all
                setSelectedItems(new Set());
                setIsSelectAll(false);
            } else {
                // Select all
                setSelectedItems(new Set(allItemIds));
                setIsSelectAll(true);
            }
        },
        [isSelectAll, selectedItems.size]
    );

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set());
        setIsSelectAll(false);
    }, []);

    const isSelected = useCallback(
        (itemId: string) => {
            return selectedItems.has(itemId);
        },
        [selectedItems]
    );

    return {
        selectedItems,
        isSelectAll,
        handleSelectItem,
        handleSelectAll,
        clearSelection,
        isSelected,
        selectedCount: selectedItems.size,
    };
};
