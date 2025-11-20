import React from "react";
import Navbar from "../modules/nav";

const faq: React.FC = () => {
    return (
        <div>
            <Navbar />

            <div className="container mt-5">
                <h1 className="text-center mb-4">Frequently Asked Questions</h1>
                <div className="accordion" id="faqAccordion">
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingOne">
                            <button
                                className="accordion-button"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target="#collapseOne"
                                aria-expanded="true"
                                aria-controls="collapseOne"
                            >
                                What is the Oligo Designer Toolsuite?
                            </button>
                        </h2>
                        <div
                            id="collapseOne"
                            className="accordion-collapse collapse show"
                            aria-labelledby="headingOne"
                            data-bs-parent="#faqAccordion"
                        >
                            <div className="accordion-body">
                                The Oligo Designer Toolsuite is a set of tools
                                designed to help researchers create and manage
                                oligonucleotide probes efficiently.
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingTwo">
                            <button
                                className="accordion-button collapsed"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target="#collapseTwo"
                                aria-expanded="false"
                                aria-controls="collapseTwo"
                            >
                                How can I access the documentation?
                            </button>
                        </h2>
                        <div
                            id="collapseTwo"
                            className="accordion-collapse collapse"
                            aria-labelledby="headingTwo"
                            data-bs-parent="#faqAccordion"
                        >
                            <div className="accordion-body">
                                You can access the documentation by clicking on
                                the "Docs" link in the navigation menu or
                                visiting{" "}
                                <a
                                    href="https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html"
                                    target="_blank"
                                >
                                    this link
                                </a>
                                .
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingThree">
                            <button
                                className="accordion-button collapsed"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target="#collapseThree"
                                aria-expanded="false"
                                aria-controls="collapseThree"
                            >
                                Can I create custom pipelines?
                            </button>
                        </h2>
                        <div
                            id="collapseThree"
                            className="accordion-collapse collapse"
                            aria-labelledby="headingThree"
                            data-bs-parent="#faqAccordion"
                        >
                            <div className="accordion-body">
                                Yes, the toolsuite supports the creation of
                                custom pipelines tailored to your specific
                                research needs.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default faq;
