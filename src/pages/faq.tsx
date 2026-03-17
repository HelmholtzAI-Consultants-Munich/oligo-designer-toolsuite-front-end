import Page from "../components/ui/Page";
import { Accordion } from "react-bootstrap";

const faq: React.FC = () => {
    return (
        <Page title="Frequently Asked Questions">
            <Accordion defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                    <Accordion.Header>
                        What is the Oligo Designer Toolsuite?
                    </Accordion.Header>
                    <Accordion.Body>
                        The Oligo Designer Toolsuite is a set of tools designed
                        to help researchers create and manage oligonucleotide
                        probes efficiently.
                    </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="1">
                    <Accordion.Header>
                        How can I access the documentation?
                    </Accordion.Header>
                    <Accordion.Body>
                        You can access the documentation by clicking on the
                        "Docs" link in the navigation menu or visiting{" "}
                        <a
                            href="https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html"
                            target="_blank"
                            className="text-decoration-underline"
                        >
                            this link
                        </a>
                        .
                    </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="2">
                    <Accordion.Header>
                        Can I create custom pipelines?
                    </Accordion.Header>
                    <Accordion.Body>
                        Yes, the toolsuite supports the creation of custom
                        pipelines tailored to your specific research needs.
                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>
        </Page>
    );
};

export default faq;
