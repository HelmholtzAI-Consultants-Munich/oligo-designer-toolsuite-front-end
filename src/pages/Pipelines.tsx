import { Link } from "react-router";
import { Breadcrumb, Button, Card, Col, Image, Row } from "react-bootstrap";
import { ArrowRight } from "react-bootstrap-icons";
import Page from "../components/ui/Page";
import { Vertical } from "../components/ui/Alignment";
import CitationCard from "../components/ui/CitationCard";
import { pipelineOverview } from "../pipelineConfig/overview";

const Pipelines: React.FC = () => {
    return (
        <Page title="Pipelines" metaTitle="ODT Cloud" hideHeader>
            <Vertical gap="lg" align="stretch">
                <Breadcrumb className="mb-0">
                    <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
                        Home
                    </Breadcrumb.Item>
                    <Breadcrumb.Item active>Pipelines</Breadcrumb.Item>
                </Breadcrumb>

                <Vertical gap="sm">
                    <h1 className="text-odt-blue">Choose a Design Pipeline</h1>
                    <p className="lead text-muted mb-0">
                        Select the workflow that best matches your experimental
                        assay.
                    </p>
                </Vertical>

                {/* TODO: restore the anonymous-user warning dropped in f99c3a8.
                    Anonymous runs are lost when the browser closes, and runs can
                    take a long time, so users can lose work with no warning. The
                    old copy was: "To keep your runs saved when you close your
                    browser, please <Link to="/login">log in</Link>." Needs
                    useAuth() here (or on the pipeline form) to gate on !user. */}
                <Row xs={1} lg={2} xl={3} className="g-5">
                    {pipelineOverview.map((pipeline) => {
                        return (
                            <Col key={pipeline.title}>
                                <Card className="h-100">
                                    <Card.Body as={Vertical} gap="md">
                                        <Image
                                            src={pipeline.image}
                                            alt=""
                                            width={72}
                                            height={72}
                                            roundedCircle
                                            style={{ objectFit: "cover" }}
                                        />
                                        <Card.Title
                                            as="h2"
                                            className="h3 text-odt-blue"
                                        >
                                            {pipeline.title}
                                        </Card.Title>
                                        <Vertical.Item grow>
                                            <Card.Text className="text-muted">
                                                {pipeline.description}
                                            </Card.Text>
                                        </Vertical.Item>
                                        {pipeline.available && pipeline.link ? (
                                            <Link
                                                to={pipeline.link}
                                                className="btn btn-outline-odt-blue w-100"
                                            >
                                                Use Pipeline{" "}
                                                <ArrowRight className="ms-2" />
                                            </Link>
                                        ) : (
                                            <Button
                                                variant="outline-odt-blue"
                                                className="w-100"
                                                disabled
                                            >
                                                Use Pipeline{" "}
                                                <ArrowRight className="ms-2" />
                                            </Button>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>

                <CitationCard />
            </Vertical>
        </Page>
    );
};

export default Pipelines;
