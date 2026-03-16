import FAQ from "./pages/faq";
import Contact from "./pages/contact";
import PrivacyPolicy from "./pages/privacy-policy";
import Pipelines from "./pages/pipelines";
import Scrinshot from "./pages/scrinshot";
import Runs from "./pages/runs";
import Merfish from "./pages/merfish";
import SeqFish from "./pages/seqfish";
import OligoSeq from "./pages/oligoseq";
import Terms from "./pages/terms";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import Login from "./pages/login";
import RunDetail from "./pages/rundetail";
import AdminApp from "./admin/AdminApp";
import FeedbackButton from "./components/feedback/FeedbackButton";
import SiteFooter from "./components/ui/SiteFooter";
import TermsAcceptanceModal from "./components/ui/TermsAcceptanceModal";
import { useAuth } from "./modules/useAuth";

function App() {
    const { user } = useAuth();

    return (
        <Router>
            {user && <FeedbackButton floating />}
            <TermsAcceptanceModal />
            <Routes>
                {/* Make "index" the main page */}
                <Route path="/login" element={<Login />} />
                <Route path="/runs" element={<Runs />} />
                <Route path="/" element={<Pipelines />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/pipelines" element={<Pipelines />} />
                <Route path="/pipelines/scrinshot" element={<Scrinshot />} />
                <Route path="/pipelines/merfish" element={<Merfish />} />
                <Route path="/pipelines/seqfish" element={<SeqFish />} />
                <Route path="/pipelines/oligoSeq" element={<OligoSeq />} />
                <Route path="/runs/:runId" element={<RunDetail />} />
                <Route path="/admin/*" element={<AdminApp />} />
            </Routes>
            <SiteFooter />
        </Router>
    );
}

export default App;
