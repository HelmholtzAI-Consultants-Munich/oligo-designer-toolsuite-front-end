import { Outlet } from "react-router";
import Sidebar from "../ui/Sidebar";
import Toasts from "../notifications/Toasts";
import { Vertical } from "../ui/Grid";
import Modal from "../notifications/Modal";
import { useAuth } from "../../modules/useAuth";

export default function DefaultLayout() {
    const { user } = useAuth();

    return (
        <div id="app-layout">
            <Sidebar />
            <Vertical grow className="min-vh-100" align="stretch" fillWidth>
                <Toasts />
                <Modal />
                <Outlet key={user?.id} /> {/* Force remount on user change */}
            </Vertical>
        </div>
    );
}
