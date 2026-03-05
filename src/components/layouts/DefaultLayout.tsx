import { Col, Row } from "react-bootstrap";
import Sidebar from "../ui/Sidebar";

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
    return (
        <Row>
            <Col xs="auto">
                <Sidebar />
            </Col>
            <Col>
                {children}
            </Col>
        </Row>
    );
}
