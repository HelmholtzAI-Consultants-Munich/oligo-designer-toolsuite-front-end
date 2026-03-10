export interface ToastProps {
    id: number;
    type: "success" | "error" | "info";
    title: string;
    description?: string;
}

export const showToast = (toast: Omit<ToastProps, "id">) => {
    const id = Date.now();
    const newToast: ToastProps = { id, ...toast };
    const event = new CustomEvent("toast:show", { detail: newToast });
    window.dispatchEvent(event);
};

export const hideToast = (id: number) => {
    const event = new CustomEvent("toast:hide", { detail: id });
    window.dispatchEvent(event);
};
