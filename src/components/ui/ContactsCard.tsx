import { Card } from "react-bootstrap";

export default function ContactsCard({
    name,
    email,
    highlight = false,
}: {
    name: string;
    email: string;
    highlight?: boolean;
}) {
    return (
        <Card
            bg={highlight ? "primary-subtle" : undefined}
            border={highlight ? "primary-subtle" : undefined}
        >
            <Card.Body>
                <Card.Title>{name}</Card.Title>
                <Card.Link href={`mailto:${email}`}>{email}</Card.Link>
            </Card.Body>
        </Card>
    );
}
