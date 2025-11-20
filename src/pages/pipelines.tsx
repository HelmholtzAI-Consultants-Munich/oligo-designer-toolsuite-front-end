import React, { useEffect } from "react";
import Navbar from "../modules/nav";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth";
import scrinshot from "../images/scrinshot.jpg";
import merfish from "../images/merfish.jpg";
import seqfish from "../images/seqfish.jpg";
import oligoseq from "../images/oligoseq.jpg";

const pipelines: React.FC = () => {
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user, loading } = useAuth();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const navigate = useNavigate(); // Define useNavigate correctly

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <Navbar />
            {!user && (
                <div className="alert alert-warning text-center" role="alert">
                    To keep your runs saved when you close your browser, please{" "}
                    <a href="/login" className="text-primary">
                        log in
                    </a>{" "}
                    or{" "}
                    <a href="/register" className="text-primary">
                        create an account
                    </a>
                    .
                </div>
            )}
            <div className="container mt-5">
                <p className="lead">
                    Oligo Designer Toolsuite is an open-source framework
                    designed to streamline the development of custom
                    oligonucleotide (oligo) design pipelines. Oligos are short
                    DNA or RNA sequences used in various applications, such as
                    research, diagnostics, and therapeutics. The Toolsuite
                    provides modular functionalities like sequence generation,
                    thermodynamic filtering, and machine learning-based
                    specificity prediction.
                </p>
                <h2 className="mt-5 mb-4 text-primary">Probe Designers</h2>
                <div className="row g-4">
                    {[
                        {
                            title: "Scrinshot Probe",
                            description:
                                "Spatial gene expression analysis using scrinshot technology.",
                            link: "/pipelines/scrinshot",
                            img: scrinshot,
                        },
                        {
                            title: "Merfish Probe",
                            link: "/pipelines/merfish",
                            description:
                                "Highly multiplexed imaging for spatially resolved transcriptomics.",
                            img: merfish,
                        },
                        {
                            title: "SeqFish+ Probe",
                            link: "/pipelines/seqfish",
                            description:
                                "Sequential imaging for probing complex spatial transcriptomes.",
                            img: seqfish,
                        },
                        {
                            title: "Oligo-Seq Probe",
                            link: "/pipelines/OligoSeq",
                            description:
                                "High-throughput sequencing tailored for spatial transcriptomics.",
                            img: oligoseq,
                        },
                    ].map((pipeline, index) => (
                        <div className="col-md-3" key={index}>
                            <div className="card border-0 shadow-sm h-100">
                                <Link to={pipeline.link}>
                                    <div className="card-img-top img-hover d-flex justify-content-center align-items-center">
                                        <img
                                            src={pipeline.img}
                                            alt={pipeline.title}
                                            className="img-fluid rounded"
                                            style={{ objectFit: "cover" }}
                                        />
                                    </div>
                                </Link>
                                <div className="card-body">
                                    <h6 className="card-title">
                                        {pipeline.title}
                                    </h6>
                                    <p className="card-text">
                                        {pipeline.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default pipelines;
