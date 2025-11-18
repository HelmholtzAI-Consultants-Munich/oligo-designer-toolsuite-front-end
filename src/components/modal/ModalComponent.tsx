import { Button, Modal } from "react-bootstrap"

export function ModalComponent({ 
    show,
    close,
    title,
    body,
    primaryAction,
    secondaryAction
}: {
    show: boolean,
    close: () => void,
    title: string,
    body: string,
    primaryAction: {
        title: string,
        callback: () => void,
    }
    secondaryAction?: {
        title: string,
        callback: () => void,
    }
}) {
    return (
        <Modal show={show} onHide={close}>
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{body}</Modal.Body>
            <Modal.Footer>
                {secondaryAction && (
                    <Button variant="secondary" onClick={secondaryAction.callback}>
                        {secondaryAction.title}
                    </Button>
                )}
                <Button variant="primary" onClick={primaryAction.callback}>
                    {primaryAction.title}
                </Button>
            </Modal.Footer>
        </Modal>
    )
}
