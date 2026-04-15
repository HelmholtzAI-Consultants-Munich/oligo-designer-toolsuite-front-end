import { useEffect, useState } from "react";
import { type ModalProps } from "../../modules/modalUtil";
import { ModalComponent } from "./ModalComponent";

export default function Modal() {
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

        return () => {
            window.removeEventListener(
                "modal:show",
                handleShow as EventListener
            );
        };
    }, []);

    if (!modal) return null;

    return (
        <ModalComponent
            show={show}
            close={handleClose}
            title={modal.title}
            content={modal.content}
            primaryAction={{
                label: modal.primaryAction.label,
                variant: modal.primaryAction.variant || "primary",
                callback: () => {
                    modal.primaryAction.callback();
                    handleClose();
                },
            }}
            secondaryAction={{
                label: "Cancel",
                variant: "outline-border",
                callback: handleClose,
            }}
        />
    );
}
