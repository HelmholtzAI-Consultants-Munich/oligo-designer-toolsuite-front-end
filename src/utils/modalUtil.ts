export interface ConfirmationModalProps {
    type: "confirmation";
    title: string;
    content: React.ReactNode;
    primaryAction: {
        label: string;
        callback: () => void;
        variant?: string;
    };
}

export type ModalProps = ConfirmationModalProps;

export const confirmWithModal = (
    props: Omit<ConfirmationModalProps, "type">
) => {
    const event = new CustomEvent("modal:show", {
        detail: { type: "confirmation", ...props },
    });
    window.dispatchEvent(event);
};
