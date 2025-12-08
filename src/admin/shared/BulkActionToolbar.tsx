import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { X } from 'react-bootstrap-icons';

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
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    position: 'sticky',
    top: '56px',
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
        <Card
            className="mb-3"
            style={toolbarStyles}
        >
            <Card.Body className="d-flex align-items-center justify-content-between py-2">
                <div className="d-flex align-items-center">
                    <span className="fw-bold me-2">
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
                </div>
                <div className="d-flex align-items-center gap-2">
                    {actions}
                </div>
            </Card.Body>
        </Card>
    );
};

export default BulkActionToolbar;

