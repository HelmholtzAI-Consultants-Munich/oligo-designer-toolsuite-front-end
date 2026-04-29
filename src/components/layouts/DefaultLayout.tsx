import { Outlet } from "react-router";
import Sidebar from "../ui/Sidebar";
import Toasts from "../notifications/Toasts";
import { Vertical } from "../ui/Alignment";
import Modal from "../notifications/Modal";
import { useAuth } from "../../hooks/useAuth";
import { useRuns } from "../../hooks/useRuns";
import Footer from "../ui/Footer";

export default function DefaultLayout() {
    const auth = useAuth();
    const user = auth.authenticated ? auth.user : null;
    const { loading } = useRuns();

    return (
        <div id="app-layout" className="min-vh-100">
            {!loading && (
                <>
                    <Sidebar />
                    <Vertical align="stretch" fillWidth>
                        <Toasts />
                        <Modal />
                        <Outlet key={user?.id} />{" "}
                        {/* Force remount on user change */}
                        <Footer />
                    </Vertical>
                </>
            )}
        </div>
    );
}
