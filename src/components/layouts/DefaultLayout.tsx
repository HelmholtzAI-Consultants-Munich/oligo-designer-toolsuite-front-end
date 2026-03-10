import { Col, Row } from "react-bootstrap";
import Sidebar from "../ui/Sidebar";
import Toasts from "../ui/Toasts";

export default function DefaultLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Row>
            <Col xs="auto">
                <Sidebar />
            </Col>
            <Col>
                <Toasts />
                {children}
            </Col>
        </Row>
    );
}
