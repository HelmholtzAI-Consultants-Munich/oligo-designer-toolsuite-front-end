import React from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../modules/useAuth";
import scrinshot from "../images/scrinshot.jpg";
import merfish from "../images/merfish.jpg";
import seqfish from "../images/seqfish.jpg";
import oligoseq from "../images/oligoseq.jpg";
import { Alert, Button, Card, Col, Row } from "react-bootstrap";
import Page from "../components/ui/Page";
import Hero from "../components/ui/Hero";
import { Grid } from "../components/ui/Grid";
import { ArrowRight } from "react-bootstrap-icons";

const Pipelines: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const pipelines = [
        {
            title: "Scrinshot Probe Designer",
            description:
                "Spatial gene expression analysis using scrinshot technology.",
            link: "/pipelines/scrinshot",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/scrinshot_probe_designer.html",
            img: scrinshot,
        },
        {
            title: "Merfish Probe Designer",
            description:
                "Highly multiplexed imaging for spatially resolved transcriptomics.",
            link: "/pipelines/merfish",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/merfish_probe_designer.html",
            img: merfish,
        },
        {
            title: "SeqFish+ Probe Designer",
            description:
                "Sequential imaging for probing complex spatial transcriptomes.",
            link: "/pipelines/seqfish",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/seqfishplus_probe_designer.html",
            img: seqfish,
        },
        {
            title: "Oligo-Seq Probe Designer",
            description:
                "High-throughput sequencing tailored for spatial transcriptomics.",
            link: "/pipelines/oligoseq",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/oligoseq_probe_designer.html",
            img: oligoseq,
        },
    ];

    if (loading) return <div>Loading...</div>;

    return (
        <Page title="Pipelines" metaTitle="ODT Cloud" hideHeader>
            <Hero />

            <h2>Our Probe Designers</h2>

            {!user && (
                <Alert variant="warning">
                    To keep your runs saved when you close your browser, please{" "}
                    <Link to="/login">log in</Link>.
                </Alert>
            )}

            <Grid gap="lg" itemWidth="400px">
                {pipelines.map((pipeline, index) => (
                    <Card key={index}>
                        <Card.Body>
                            <Card.Title>{pipeline.title}</Card.Title>
                            <Card.Text className="text-muted">
                                {pipeline.description}
                            </Card.Text>
                            <Card.Link
                                as={Button}
                                onClick={() => navigate(pipeline.link)}
                            >
                                Use Pipeline
                            </Card.Link>
                            <Card.Link
                                as={Link}
                                to={pipeline.detailedLink}
                                target="_blank"
                            >
                                Read about {pipeline.title} <ArrowRight />
                            </Card.Link>
                        </Card.Body>
                    </Card>
                ))}
            </Grid>
        </Page>
    );
};

export default Pipelines;
