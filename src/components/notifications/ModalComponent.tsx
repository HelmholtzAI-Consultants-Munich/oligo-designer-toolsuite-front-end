import { useEffect, useState } from "react";
import { type ModalProps } from "../../utils/modalUtil";
import { Button, Modal } from "react-bootstrap";

export default function ModalComponent() {
    const [modal, setModal] = useState<ModalProps | null>(null);
    const [show, setShow] = useState(false);

    const handleShow = (event: CustomEvent) => {
        setModal(event.detail);
        setShow(true);
    };

    const handleClose = () => {
        setShow(false);
    };

    useEffect(() => {
        window.addEventListener("modal:show", handleShow as EventListener);
        window.addEventListener("modal:close", handleClose as EventListener);

        return () => {
            window.removeEventListener(
                "modal:show",
                handleShow as EventListener
            );
            window.removeEventListener(
                "modal:close",
                handleClose as EventListener
            );
        };
    }, []);

    if (!modal) return null;

    return (
        <Modal show={show} onHide={handleClose}>
            {"rawContent" in modal ? (
                modal.rawContent
            ) : (
                <>
                    <Modal.Header closeButton>
                        <Modal.Title>{modal.title}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>{modal.content}</Modal.Body>
                    <Modal.Footer>
                        {modal.secondaryAction && (
                            <Button
                                variant={
                                    modal.secondaryAction.variant || "secondary"
                                }
                                onClick={modal.secondaryAction.callback}
                            >
                                {modal.secondaryAction.label}
                            </Button>
                        )}
                        {modal.primaryAction && (
                            <Button
                                variant={
                                    modal.primaryAction.variant || "primary"
                                }
                                onClick={modal.primaryAction.callback}
                            >
                                {modal.primaryAction.label}
                            </Button>
                        )}
                    </Modal.Footer>
                </>
            )}
        </Modal>
    );
}
