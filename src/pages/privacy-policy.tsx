import LegalDocumentPage from "../components/ui/LegalDocumentPage";

const PrivacyPolicy: React.FC = () => {
    return <LegalDocumentPage endpoint="/api/legal/privacy-policy" />;
};

export default PrivacyPolicy;
