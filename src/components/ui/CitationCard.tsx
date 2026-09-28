import { Card } from "react-bootstrap";
import { Book, BoxArrowUpRight } from "react-bootstrap-icons";
import { Horizontal, Vertical } from "./Alignment";

/** Publication to cite when ODT is used in research. */
const PUBLICATION_URL = "https://doi.org/10.5281/zenodo.7823048";

/**
 * Renders the card asking users to cite the Oligo Designer Toolsuite
 * publication.
 *
 * @returns A React Component that renders the citation card
 */
export default function CitationCard() {
    return (
        <Card bg="primary-subtle" className="w-100 border-0">
            <Card.Body>
                <Horizontal align="center" gap="lg" wrap>
                    <div className="bg-white rounded-circle d-flex align-items-center justify-content-center p-3">
                        <Book size={24} />
                    </div>
                    <Vertical grow gap="xs">
                        <Card.Title as="h2" className="h5 text-odt-blue">
                            Cite Oligo Designer Toolsuite
                        </Card.Title>
                        <Card.Text className="text-muted mb-0">
                            If you use ODT in your research, please cite the
                            associated publication.
                        </Card.Text>
                    </Vertical>
                    <Card.Link
                        href={PUBLICATION_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ms-auto text-nowrap"
                    >
                        View the publication <BoxArrowUpRight size={14} />
                    </Card.Link>
                </Horizontal>
            </Card.Body>
        </Card>
    );
}
