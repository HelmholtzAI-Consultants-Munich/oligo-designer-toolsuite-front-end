import React from 'react';
import './App.css';
import FAQ from "./pages/faq";
import Index from "./pages/index";
import Contacts from "./pages/contacs";
import Pipelines from "./pages/pipelines";
import Scrinshot from "./pages/scrinshot";
import Runs from "./pages/runs";
import Genomic from "./pages/genomic";
import Merfish from "./pages/merfish";
import  SeqFish from "./pages/seqfish";
import OligoSeq from "./pages/OligoSeq";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import Login from "./pages/login";
function App() {
    return (
        <Router>
            <Routes>
                {/* Make "index" the main page */}
                <Route path="/login" element={<Login />} />
                <Route path="/pipelines/genomic" element={<Genomic />} />
                <Route path="/runs" element={<Runs />} />
                <Route path="/" element={<Pipelines />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/pipelines" element={<Pipelines />} />
                <Route path="/pipelines/scrinshot" element={<Scrinshot />} />
                <Route path="/pipelines/merfish" element={<Merfish />} />
                <Route path="/pipelines/seqfish" element={<SeqFish />} />
                <Route path="/pipelines/oligoSeq" element={<OligoSeq />} />

            </Routes>
        </Router>
    );
}

export default App;
