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

const Pipelines: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

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
        <Page title="Pipelines" metaTitle="ODT Cloud" hideHeader>
            <Hero />

            <h2>Our Probe Designers</h2>

            <Grid gap="lg" itemWidth="400px">
                {pipelines.map((pipeline, index) => (
                    <Card key={index}>
                        <Card.Body>
                            <Card.Title>{pipeline.title}</Card.Title>
                            <Card.Text>{pipeline.description}</Card.Text>
                            <Card.Link as={Button} onClick={() => navigate(pipeline.link)}>
                                Use Pipeline
                            </Card.Link>
                            <Card.Link as={Link} to={pipeline.link}>
                                Read about {pipeline.title}
                            </Card.Link>
                        </Card.Body>
                    </Card>
                ))}
            </Grid>

            {!user && (
                <Alert variant="warning">
                    To keep your runs saved when you close your browser, please{" "}
                    <Link to="/login">log in</Link>.
                </Alert>
            )}
        </Page>
    );
};

export default Pipelines;
