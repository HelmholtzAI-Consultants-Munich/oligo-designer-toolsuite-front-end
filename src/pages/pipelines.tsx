import React from "react";
import Navbar from "../components/ui/Topbar";
import { Link } from "react-router";
import { useAuth } from "../modules/useAuth";
import scrinshot from "../images/scrinshot.jpg";
import merfish from "../images/merfish.jpg";
import seqfish from "../images/seqfish.jpg";
import oligoseq from "../images/oligoseq.jpg";
import { Alert, Card, Col, Container, Row } from "react-bootstrap";

const Pipelines: React.FC = () => {
    const { user, loading } = useAuth();

    const pipelines = [
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
            link: "/pipelines/oligoseq",
            description:
                "High-throughput sequencing tailored for spatial transcriptomics.",
            img: oligoseq,
        },
    ];

    if (loading) return <div>Loading...</div>;

    return (
        <>
            <Navbar />

            {!user && (
                <Alert variant="warning">
                    To keep your runs saved when you close your browser, please{" "}
                    <Link to="/login">log in</Link> or{" "}
                    <Link to="/register">create an account</Link>.
                </Alert>
            )}

            <Container>
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

                <h2>Probe Designers</h2>

                <Row>
                    {pipelines.map((pipeline, index) => (
                        <Col md={3} key={index}>
                            <Card>
                                <Card.Img
                                    variant="top"
                                    src={pipeline.img}
                                    alt={pipeline.title}
                                />
                                <Card.Body>
                                    <Card.Title>{pipeline.title}</Card.Title>
                                    <Card.Text>
                                        {pipeline.description}
                                    </Card.Text>
                                    <Card.Link as={Link} to={pipeline.link}>
                                        Go to Pipeline
                                    </Card.Link>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Container>
        </>
    );
};

export default Pipelines;
