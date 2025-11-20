import React from "react";
import Navbar from "../modules/nav";
const contacts: React.FC = () => {
    return (
        <div>
            <head>
                <meta charSet="UTF-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <title>Oligo Designer Toolsuite</title>
                <link rel="icon" href="/ODT_logo 1.svg" type="image/x-icon" />
                <link
                    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
                    rel="stylesheet"
                    integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
                    crossOrigin="anonymous"
                />
            </head>
            <body>
                <Navbar />
                <div className="container mt-5">
                    <h1 className="text-center mb-4"> Our Team</h1>

                    <div className="row d-flex align-items-stretch">
                        <div className="col-md-3 d-flex">
                            <div className="card mb-4 shadow-sm h-100 w-100">
                                <div className="card-body">
                                    <h5 className="card-title">Yarkin Eren</h5>
                                    <p>
                                        <a href="mailto:yarkin.eren@helmholtz-munich.de">
                                            yarkin.eren@helmholtz-munich.de
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="col-md-3 d-flex">
                            <div className="card mb-4 shadow-sm h-100 w-100">
                                <div className="card-body">
                                    <h5 className="card-title">
                                        Francesco Campi
                                    </h5>
                                    <p>
                                        <a href="mailto:francesco.campi@helmholtz-munich.de">
                                            francesco.campi@helmholtz-munich.de
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="col-md-3 d-flex">
                            <div className="card mb-4 shadow-sm h-100 w-100">
                                <div className="card-body">
                                    <h5 className="card-title">Lisa Barros</h5>
                                    <p>
                                        {" "}
                                        <a href="mailto:lisa.barros@helmholtz-munich.de">
                                            lisa.barros@helmholtz-munich.de
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-3 d-flex">
                            <div className="card mb-4 shadow-sm h-100 w-100">
                                <div className="card-body">
                                    <h5 className="card-title">
                                        Jonas Hagenberg
                                    </h5>
                                    <p>
                                        {" "}
                                        <a href="mailto:jonas.hagenberg@helmholtz-munich.de">
                                            jonas.hagenberg@helmholtz-munich.de
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </div>
    );
};

export default contacts;
