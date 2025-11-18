import { ModalComponent } from "./ModalComponent";

export function InfoModal({
    show,
    close,
    title,
    body,
}: {
    show: boolean,
    close: () => void,
    title: string,
    body: string,
}) {
    return (
        <ModalComponent
            show={show}
            close={close}
            title={title}
            body={body}
            primaryAction={{
                title: "Close",
                callback: close
            }}
        />
    )
}
