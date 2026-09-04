import { Col, Row } from "react-bootstrap";
import { Bullseye, Cloud, GraphUpArrow } from "react-bootstrap-icons";
import Page from "../components/ui/Page";
import Hero from "../components/ui/Hero";
import { Vertical } from "../components/ui/Alignment";
import CitationCard from "../components/ui/CitationCard";

export default function Home() {
    return (
        <Page title="Oligo Designer Toolsuite" metaTitle="ODT Cloud" hideHeader>
            <Vertical align="stretch" gap="lg">
                <Hero />
                <Row xs={1} lg={4} className="g-5">
                    <Col>
                        <Vertical
                            align="center"
                            gap="md"
                            className="text-center"
                        >
                            <Cloud className="text-odt-blue" size={48} />
                            <h2 className="fs-5 mb-0 text-odt-blue">
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
                            <Bullseye className="text-odt-blue" size={48} />
                            <h2 className="fs-5 mb-0 text-odt-blue">
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
                            <GraphUpArrow className="text-odt-blue" size={48} />
                            <h2 className="fs-5 mb-0 text-odt-blue">
                                Multiple assays
                            </h2>
                            <p className="text-muted mb-0">
                                Support for a variety of spatial and sequencing
                                assays.
                            </p>
                        </Vertical>
                    </Col>
                </Row>
                <CitationCard />
            </Vertical>
        </Page>
    );
}
