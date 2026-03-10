import FAQ from "./pages/faq";
import Contact from "./pages/contact";
import Pipelines from "./pages/pipelines";
import Scrinshot from "./pages/scrinshot";
import Runs from "./pages/runs";
import Merfish from "./pages/merfish";
import SeqFish from "./pages/seqfish";
import OligoSeq from "./pages/oligoseq";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import "./styles/theme.scss";
import "./styles/utils.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fontsource-variable/fustat";

import Login from "./pages/login";
import RunDetail from "./pages/rundetail";
import AdminApp from "./admin/AdminApp";
import DefaultLayout from "./components/layouts/DefaultLayout";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/admin/*" element={<AdminApp />} />
                <Route element={<DefaultLayout />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/runs" element={<Runs />} />
                    <Route path="/" element={<Pipelines />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/pipelines" element={<Pipelines />} />
                    <Route
                        path="/pipelines/scrinshot"
                        element={<Scrinshot />}
                    />
                    <Route path="/pipelines/merfish" element={<Merfish />} />
                    <Route path="/pipelines/seqfish" element={<SeqFish />} />
                    <Route path="/pipelines/oligoSeq" element={<OligoSeq />} />
                    <Route path="/runs/:runId" element={<RunDetail />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
