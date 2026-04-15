import { Button, Modal } from "react-bootstrap";

export function ModalComponent({
    show,
    close,
    title,
    content,
    primaryAction,
    secondaryAction,
}: {
    show: boolean;
    close: () => void;
    title: string;
    content: React.ReactNode;
    primaryAction: {
        label: string;
        callback: () => void;
        variant?: string;
    };
    secondaryAction?: {
        label: string;
        callback: () => void;
        variant?: string;
    };
}) {
    return (
        <Modal show={show} onHide={close}>
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{content}</Modal.Body>
            <Modal.Footer>
                {secondaryAction && (
                    <Button
                        variant={secondaryAction.variant || "secondary"}
                        onClick={secondaryAction.callback}
                    >
                        {secondaryAction.label}
                    </Button>
                )}
                <Button
                    variant={primaryAction.variant || "primary"}
                    onClick={primaryAction.callback}
                >
                    {primaryAction.label}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
