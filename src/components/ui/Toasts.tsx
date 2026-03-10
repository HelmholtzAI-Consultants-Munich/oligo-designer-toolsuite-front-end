import { Toast, ToastContainer } from "react-bootstrap";
import { hideToast, type ToastProps } from "../../modules/toastUtil";
import { useEffect, useState } from "react";

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
        <ToastContainer position="top-end" className="position-absolute">
            {toasts.map((toast) => (
                <Toast
                    onClose={() => hideToast(toast.id)}
                    autohide
                    delay={3000}
                    key={toast.id}
                >
                    <Toast.Header>
                        <strong>{toast.title}</strong>
                    </Toast.Header>
                    <Toast.Body>{toast.description}</Toast.Body>
                </Toast>
            ))}
        </ToastContainer>
    );
}
