import ReactMarkdown from "react-markdown";

interface LegalMarkdownProps {
    body: string;
}

const LegalMarkdown: React.FC<LegalMarkdownProps> = ({ body }) => {
    return <ReactMarkdown>{body}</ReactMarkdown>;
};

export default LegalMarkdown;
