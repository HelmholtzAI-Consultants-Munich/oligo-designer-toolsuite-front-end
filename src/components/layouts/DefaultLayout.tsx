import { Col, Row } from "react-bootstrap";
import { Outlet } from "react-router";
import Sidebar from "../ui/Sidebar";
import Toasts from "../ui/Toasts";

export default function DefaultLayout() {
    return (
        <Row>
            <Col xs="auto">
                <Sidebar />
            </Col>
            <Col>
                <Toasts />
                <Outlet />
            </Col>
        </Row>
    );
}
