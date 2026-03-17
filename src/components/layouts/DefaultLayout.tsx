import { Outlet } from "react-router";
import Sidebar from "../ui/Sidebar";
import Toasts from "../notifications/Toasts";
import { Horizontal, Vertical } from "../ui/Grid";
import Modal from "../notifications/Modal";

export default function DefaultLayout() {
    return (
        <Horizontal>
            <Sidebar />
            <Vertical grow className="min-vh-100" align="stretch">
                <Toasts />
                <Modal />
                <Outlet />
            </Vertical>
        </Horizontal>
    );
}
