import { Alert } from "react-bootstrap";

export function AlertComponent({
    variant,
    children,
}: {
    variant: string;
    children: React.ReactNode;
}) {
    return (
        <Alert variant={variant}>
            {children}
        </Alert>
    );
}
