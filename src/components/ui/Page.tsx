import { Container } from "react-bootstrap";

export default function Page({ children }: { children: React.ReactNode }) {
    return (
        <Container className="page">
            {children}
        </Container>
    )
};
