import { Card } from "react-bootstrap";

export default function ContactsCard({
    name,
    email,
}: {
    name: string;
    email: string;
}) {
    return (
        <Card>
            <Card.Body>
                <Card.Title>{name}</Card.Title>
                <Card.Link href={`mailto:${email}`}>{email}</Card.Link>
            </Card.Body>
        </Card>
    );
}
