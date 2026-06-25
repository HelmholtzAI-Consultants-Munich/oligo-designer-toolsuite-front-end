import React from "react";
import { Card, Button } from "react-bootstrap";
import { X } from "react-bootstrap-icons";
import { Horizontal } from "../../components/ui/Alignment";

interface BulkActionToolbarProps {
    selectedCount: number;
    itemName: string; // e.g., "users", "runs"
    onClearSelection: () => void;
    actions: React.ReactNode;
}

/**
 * Styles for the bulk action toolbar card
 */
const toolbarStyles: React.CSSProperties = {
    backgroundColor: "#e7f3ff",
    border: "1px solid #b3d9ff",
    position: "sticky",
    top: "56px",
    zIndex: 100,
};

/**
 * Reusable bulk action toolbar component
 * Shows when items are selected and provides action buttons
 */
const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
    selectedCount,
    itemName,
    onClearSelection,
    actions,
}) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <Card className="mb-3" style={toolbarStyles}>
            <Card.Body className="py-2">
                <Horizontal align="center" justify="space-between">
                    <Horizontal align="center" gap="sm">
                        <span className="fw-bold">
                            {selectedCount} {itemName} selected
                        </span>
                        <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-muted"
                            onClick={onClearSelection}
                            title="Clear selection"
                        >
                            <X size={16} />
                        </Button>
                    </Horizontal>
                    <Horizontal align="center" gap="sm">
                        {actions}
                    </Horizontal>
                </Horizontal>
            </Card.Body>
        </Card>
    );
};

export default BulkActionToolbar;
