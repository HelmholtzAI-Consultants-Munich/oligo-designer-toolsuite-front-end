import { useNavigate } from "react-router-dom";
import { ModalComponent } from "./ModalComponent";

export function RunLinkModal({
    show,
    close,
    runId,
    title,
    body,
}: {
    show: boolean;
    close: () => void;
    runId: string;
    title: string;
    body: string;
}) {
    const navigate = useNavigate();

    return (
        <ModalComponent
            show={show}
            close={close}
            title={title}
            body={body}
            primaryAction={{
                title: "Show Run",
                callback: () => {
                    navigate(`/runs/${runId}`);
                },
            }}
            secondaryAction={{
                title: "Close",
                callback: close,
            }}
        />
    );
}
