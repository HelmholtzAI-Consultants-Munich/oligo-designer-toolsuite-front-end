import { Alert, Container } from "react-bootstrap";

interface RunLocallyInfoBoxProps {
    url?: string;
    text?: string;
}

const RunLocallyInfoBox: React.FC<RunLocallyInfoBoxProps> = ({
    url = "https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite?tab=readme-ov-file",
    text = "Want to run this pipeline locally?",
}) => (
    <Container>
        <Alert variant="info">
            <strong>{text} </strong>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-primary"
            >
                View on GitHub
            </a>
        </Alert>
    </Container>
);

export default RunLocallyInfoBox;
