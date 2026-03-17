import { Toast, ToastContainer } from "react-bootstrap";
import { hideToast, type ToastProps } from "../../modules/toastUtil";
import { useEffect, useState } from "react";
import {
    CheckCircleFill,
    InfoCircleFill,
    XCircleFill,
} from "react-bootstrap-icons";
import { Horizontal } from "../ui/Grid";

function ToastIcon({ type }: { type: string }) {
    switch (type) {
        case "success":
            return <CheckCircleFill className="text-success" />;
        case "danger":
            return <XCircleFill className="text-danger" />;
        case "info":
            return <InfoCircleFill className="text-info" />;
        default:
            return null;
    }
}

export default function Toasts() {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const handleShow = (event: CustomEvent) => {
        setToasts((prevToasts) => [
            ...prevToasts,
            {
                id: Date.now(),
                ...event.detail,
            },
        ]);
    };

    const handleHide = (event: CustomEvent) => {
        setToasts((prevToasts) =>
            prevToasts.filter((toast) => toast.id !== event.detail)
        );
    };

    useEffect(() => {
        window.addEventListener("toast:show", handleShow as EventListener);
        window.addEventListener("toast:hide", handleHide as EventListener);

        return () => {
            window.removeEventListener(
                "toast:show",
                handleShow as EventListener
            );
            window.removeEventListener(
                "toast:hide",
                handleHide as EventListener
            );
        };
    }, []);

    return (
        <ToastContainer position="top-end" className="position-fixed p-3">
            {toasts.map((toast) => (
                <Toast
                    onClose={() => hideToast(toast.id)}
                    delay={3000}
                    autohide
                    key={toast.id}
                    bg={toast.type}
                >
                    <Toast.Header>
                        <Horizontal align="center" gap="sm" fillWidth>
                            <ToastIcon type={toast.type} />
                            <strong>{toast.title}</strong>
                        </Horizontal>
                    </Toast.Header>
                    <Toast.Body>{toast.content}</Toast.Body>
                </Toast>
            ))}
        </ToastContainer>
    );
}
