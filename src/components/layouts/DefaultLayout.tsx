import { Outlet } from "react-router";
import Sidebar from "../ui/Sidebar";
import Toasts from "../ui/Toasts";
import { Horizontal, Vertical } from "../ui/Grid";

export default function DefaultLayout() {
    return (
        <Horizontal>
            <Sidebar />
            <Vertical grow className="min-vh-100" align="stretch">
                <Toasts />
                <Outlet />
            </Vertical>
        </Horizontal>
    );
}
