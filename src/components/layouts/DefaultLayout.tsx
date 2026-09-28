import { Outlet } from "react-router";
import Sidebar from "../ui/Sidebar";
import Toasts from "../notifications/Toasts";
import { Vertical } from "../ui/Alignment";
import Modal from "../notifications/ModalComponent";
import { useAuth } from "../../hooks/useAuth";
import { useRuns } from "../../hooks/useRuns";
import Footer from "../ui/Footer";
import TopNavigation from "../ui/TopNavigation";

export default function DefaultLayout() {
    const auth = useAuth();
    const user = auth.user;
    const { loading } = useRuns();

    return (
        <div id="app-layout" className="min-vh-100">
            {!loading && (
                <>
                    <TopNavigation />
                    <div className="d-flex flex-column flex-lg-row flex-grow-1">
                        <Sidebar />
                        <Vertical align="stretch" fillWidth grow>
                            <Toasts />
                            <Modal />
                            <Outlet key={user?.id} />{" "}
                            {/* Force remount on user change */}
                            <Footer />
                        </Vertical>
                    </div>
                </>
            )}
        </div>
    );
}
