import { showToast } from "../../utils/toastUtil";

/**
 * Helper function to handle common success operations after bulk operations
 *
 * @param message - Success message to display
 * @param clearSelection - Function to clear the selection
 * @param refreshData - Function to refresh the data
 */
export const handleBulkOperationSuccess = (
    message: string,
    clearSelection: () => void,
    refreshData: () => void
) => {
    showToast({
        type: "success",
        title: "Bulk operation complete",
        content: message,
    });
    clearSelection();
    refreshData();
};
