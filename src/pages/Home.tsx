import { Card, Col, Row } from "react-bootstrap";
import {
    Book,
    BoxArrowUpRight,
    Bullseye,
    Cloud,
    GraphUpArrow,
} from "react-bootstrap-icons";
import Page from "../components/ui/Page";
import Hero from "../components/ui/Hero";
import { Horizontal, Vertical } from "../components/ui/Alignment";

export default function Home() {
    return (
        <Page title="Oligo Designer Toolsuite" metaTitle="ODT Cloud" hideHeader>
            <Vertical align="stretch" gap="lg" className="ms-lg-5 ps-lg-4">
                <Hero />
                <Row xs={1} lg={4} className="g-5">
                    <Col>
                        <Vertical
                            align="center"
                            gap="md"
                            className="text-center"
                        >
                            <Cloud color="#006593" size={48} />
                            <h2
                                className="fs-5 mb-0"
                                style={{ color: "#006593" }}
                            >
                                Cloud-based
                            </h2>
                            <p className="text-muted mb-0">
                                Run scalable workflows in the cloud with
                                reproducible results.
                            </p>
                        </Vertical>
                    </Col>
                    <Col>
                        <Vertical
                            align="center"
                            gap="md"
                            className="text-center"
                        >
                            <Bullseye color="#006593" size={48} />
                            <h2
                                className="fs-5 mb-0"
                                style={{ color: "#006593" }}
                            >
                                High specificity
                            </h2>
                            <p className="text-muted mb-0">
                                Advanced algorithms maximize specificity and
                                minimize cross-hybridization.
                            </p>
                        </Vertical>
                    </Col>
                    <Col>
                        <Vertical
                            align="center"
                            gap="md"
                            className="text-center"
                        >
                            <GraphUpArrow color="#006593" size={48} />
                            <h2
                                className="fs-5 mb-0"
                                style={{ color: "#006593" }}
                            >
                                Multiple assays
                            </h2>
                            <p className="text-muted mb-0">
                                Support for a variety of spatial and sequencing
                                assays.
                            </p>
                        </Vertical>
                    </Col>
                </Row>
                <Card bg="primary-subtle" className="w-100 border-0">
                    <Card.Body>
                        <Horizontal align="center" gap="lg">
                            <div className="bg-white rounded-circle d-flex align-items-center justify-content-center p-3">
                                <Book size={24} />
                            </div>
                            <Vertical grow gap="xs">
                                <Card.Title
                                    as="h2"
                                    className="h5"
                                    style={{ color: "#006593" }}
                                >
                                    Cite Oligo Designer Toolsuite
                                </Card.Title>
                                <Card.Text className="text-muted mb-0">
                                    If you use ODT in your research, please cite
                                    the associated publication.
                                </Card.Text>
                            </Vertical>
                            <Card.Link
                                href="https://doi.org/10.5281/zenodo.7823048"
                                target="_blank"
                                className="ms-auto text-nowrap"
                            >
                                View the publication{" "}
                                <BoxArrowUpRight size={14} />
                            </Card.Link>
                        </Horizontal>
                    </Card.Body>
                </Card>
            </Vertical>
        </Page>
    );
}
