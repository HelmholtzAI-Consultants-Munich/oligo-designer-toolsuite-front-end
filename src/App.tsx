import React from "react";
import "./App.css";
import FAQ from "./pages/faq";
import Contacts from "./pages/contacs";
import Pipelines from "./pages/pipelines";
import Scrinshot from "./pages/scrinshot";
import Runs from "./pages/runs";
import Merfish from "./pages/merfish";
import SeqFish from "./pages/seqfish";
import OligoSeq from "./pages/oligoseq";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import Login from "./pages/login";
import Register from "./pages/register";
import RunDetail from "./pages/rundetail";
import AdminApp from "./admin/AdminApp";
import FeedbackButton from "./components/feedback/FeedbackButton";

function App() {
    return (
        <Router>
            <FeedbackButton floating />
            <Routes>
                {/* Make "index" the main page */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/runs" element={<Runs />} />
                <Route path="/" element={<Pipelines />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/pipelines" element={<Pipelines />} />
                <Route path="/pipelines/scrinshot" element={<Scrinshot />} />
                <Route path="/pipelines/merfish" element={<Merfish />} />
                <Route path="/pipelines/seqfish" element={<SeqFish />} />
                <Route path="/pipelines/oligoSeq" element={<OligoSeq />} />
                <Route path="/runs/:runId" element={<RunDetail />} />
                <Route path="/admin/*" element={<AdminApp />} />
            </Routes>
        </Router>
    );
}

export default App;
