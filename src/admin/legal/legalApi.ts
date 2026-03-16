import axios from "axios";

import { BACKEND_URL } from "../../config";

export interface LegalDocumentVersion {
    id: string;
    document: string;
    label: string;
    body: string;
    version: string;
    status: "published" | "archived";
    published_at?: string | null;
}

export interface LegalDocumentAdminView {
    document: string;
    label: string;
    published: LegalDocumentVersion | null;
    history: LegalDocumentVersion[];
}

const adminLegalUrl = (path: string) =>
    `${BACKEND_URL}/api/admin/legal-documents${path}`;

export const fetchLegalDocumentsOverview = async () => {
    const response = await axios.get(adminLegalUrl(""), {
        withCredentials: true,
    });
    return response.data as LegalDocumentAdminView[];
};

export const fetchLegalDocumentDetail = async (documentKey: string) => {
    const response = await axios.get(adminLegalUrl(`/${documentKey}`), {
        withCredentials: true,
    });
    return response.data as LegalDocumentAdminView;
};

export const publishLegalDocument = async (
    documentKey: string,
    body: string
) => {
    const response = await axios.post(
        adminLegalUrl(`/${documentKey}/publish`),
        { body },
        { withCredentials: true }
    );
    return response.data as LegalDocumentAdminView;
};
