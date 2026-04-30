import LegalDocumentPage from "../components/ui/LegalDocumentPage";

const Terms: React.FC = () => {
    return (
        <LegalDocumentPage
            endpoint="/api/legal/terms"
            title="Terms of Service"
        />
    );
};

export default Terms;
