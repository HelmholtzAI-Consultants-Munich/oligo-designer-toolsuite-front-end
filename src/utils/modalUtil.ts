// ModalPropsBase is used for standard modals with independent title, content and actions
interface ModalPropsBase {
    title: string;
    content: React.ReactNode;
    primaryAction?: {
        label: string;
        callback: () => void;
        variant?: string;
    };
    secondaryAction?: {
        label: string;
        callback: () => void;
        variant?: string;
    };
}

// ModalPropsRaw is used for custom modals with full control over the content
interface ModalPropsRaw {
    rawContent: React.ReactNode;
}

export type ModalProps = ModalPropsBase | ModalPropsRaw;

export interface ConfirmationModalProps {
    title: string;
    content: React.ReactNode;
    primaryAction: {
        label: string;
        callback: () => void;
        variant?: string;
    };
}

export const closeModal = () => {
    window.dispatchEvent(new CustomEvent("modal:close"));
};

export const confirmWithModal = (props: ConfirmationModalProps) => {
    const event = new CustomEvent("modal:show", {
        detail: {
            ...props,
            primaryAction: {
                ...props.primaryAction,
                callback: () => {
                    props.primaryAction.callback();
                    closeModal();
                },
            },
            secondaryAction: {
                label: "Cancel",
                callback: closeModal,
                variant: "outline-border",
            },
        },
    });
    window.dispatchEvent(event);
};

export const showModal = (props: ModalProps) => {
    const event = new CustomEvent("modal:show", {
        detail: props,
    });
    window.dispatchEvent(event);
};
