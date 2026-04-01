import React from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import scrinshot from "../images/scrinshot.jpg";
import merfish from "../images/merfish.jpg";
import seqfish from "../images/seqfish.jpg";
import oligoseq from "../images/oligoseq.jpg";
import { Alert, Button, Card } from "react-bootstrap";
import Page from "../components/ui/Page";
import Hero from "../components/ui/Hero";
import { Grid, Vertical } from "../components/ui/Alignment";
import { ArrowRight } from "react-bootstrap-icons";

const Pipelines: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const pipelines = [
        {
            title: "Scrinshot",
            description:
                "Spatial gene expression analysis using scrinshot technology.",
            link: "/pipelines/scrinshot",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/scrinshot_probe_designer.html",
            img: scrinshot,
        },
        {
            title: "Merfish",
            description:
                "Highly multiplexed imaging for spatially resolved transcriptomics.",
            link: "/pipelines/merfish",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/merfish_probe_designer.html",
            img: merfish,
        },
        {
            title: "SeqFish+",
            description:
                "Sequential imaging for probing complex spatial transcriptomes.",
            link: "/pipelines/seqfish",
            detailedLink:
                "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/seqfishplus_probe_designer.html",
            img: seqfish,
        },
        {
            title: "Oligo-Seq",
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

            <Vertical className="tight-container" gap="lg" align="stretch">
                {!user && (
                    <Alert variant="warning">
                        To keep your runs saved when you close your browser,
                        please <Link to="/login">log in</Link>.
                    </Alert>
                )}

                <Grid gap="lg" itemWidth="25rem">
                    {pipelines.map((pipeline, index) => (
                        <Card key={index}>
                            <Card.Body as={Vertical} gap="md">
                                <Card.Title as="h4">
                                    {pipeline.title} Probe Designer
                                </Card.Title>
                                <Vertical.Item grow>
                                    <Card.Text className="text-muted">
                                        {pipeline.description}
                                    </Card.Text>
                                </Vertical.Item>
                                <Vertical.Item>
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
                                        Read about {pipeline.title}{" "}
                                        <ArrowRight />
                                    </Card.Link>
                                </Vertical.Item>
                            </Card.Body>
                        </Card>
                    ))}
                </Grid>
            </Vertical>
        </Page>
    );
};

export default Pipelines;
