import { Link } from "react-router";
import { Breadcrumb, Button, Card, Col, Image, Row } from "react-bootstrap";
import { ArrowRight, Book } from "react-bootstrap-icons";
import Page from "../components/ui/Page";
import { Horizontal, Vertical } from "../components/ui/Alignment";
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

                <Row xs={1} lg={2} xl={3} className="g-5">
                    {pipelineOverview.map((pipeline) => {
                        return (
                            <Col key={pipeline.title}>
                                <Card
                                    className="h-100 mx-auto"
                                    style={{ width: "90%" }}
                                >
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
                                        {/* render as a real link when usable, so it
                                            supports new-tab and middle click */}
                                        <Button
                                            variant="outline-odt-blue"
                                            className="w-100"
                                            {...(pipeline.available &&
                                            pipeline.link
                                                ? {
                                                      as: Link,
                                                      to: pipeline.link,
                                                  }
                                                : { disabled: true })}
                                        >
                                            Use Pipeline{" "}
                                            <ArrowRight className="ms-2" />
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>

                <Card bg="primary-subtle" className="border-0">
                    <Card.Body>
                        <Horizontal align="center" gap="lg">
                            <div className="bg-white rounded-circle d-flex align-items-center justify-content-center p-3">
                                <Book size={24} />
                            </div>
                            <Vertical grow gap="xs">
                                <Card.Title
                                    as="h2"
                                    className="h5 text-odt-blue"
                                >
                                    Please cite Oligo Designer Toolsuite
                                </Card.Title>
                                <Card.Text className="text-muted mb-0">
                                    If you use Oligo Designer Toolsuite, please
                                    cite our publication.
                                </Card.Text>
                            </Vertical>
                            <Card.Link
                                href="https://doi.org/10.5281/zenodo.7823048"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ms-auto text-nowrap"
                            >
                                View publication <ArrowRight className="ms-1" />
                            </Card.Link>
                        </Horizontal>
                    </Card.Body>
                </Card>
            </Vertical>
        </Page>
    );
};

export default Pipelines;
