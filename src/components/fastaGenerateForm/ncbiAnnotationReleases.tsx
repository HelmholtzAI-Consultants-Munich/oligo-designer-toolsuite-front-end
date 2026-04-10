import { useCallback, useEffect, useState } from "react";
import { BACKEND_URL } from "../../config";
import axios from "axios";
import type { FastaForm } from "./types";

interface NcbiAnnotationReleasesProps {
    form: FastaForm;
}

export const NcbiAnnotationReleases: React.FC<NcbiAnnotationReleasesProps> = ({
    form,
}) => {
    const [releases, setReleases] = useState<string[]>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const kingdom = form.formDataNcbi.source_params.taxon.value;
    const species = form.formDataNcbi.source_params.species.value;

    const fetchAnnotationReleasesNCBI = useCallback(
        async (species: string, kingdom: string) => {
            try {
                setIsLoading(true);
                setError(null);
                const DROPDOWN_URL =
                    BACKEND_URL + `/api/genomic/releases/${kingdom}/${species}`;
                const response = await axios.get(DROPDOWN_URL, {
                    withCredentials: true,
                });
                setReleases(response.data);
            } catch (err: unknown) {
                if (axios.isAxiosError(err)) {
                    setError(
                        err.response?.data?.error ||
                            "Failed to load Annotation Releases"
                    );
                } else {
                    setError("Failed to load Annotation Releases");
                }
                console.error("Error fetching Annotation Releases:", err);
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        fetchAnnotationReleasesNCBI(species, kingdom);
    }, [species, kingdom, fetchAnnotationReleasesNCBI]);

    if (isLoading) {
        return <option>Loading annotation releases...</option>;
    }

    if (error || !releases) {
        return <option>Error while loading annotation releases!</option>;
    }

    return releases.map((release, idx) => (
        <option key={idx} value={release}>
            {release}
        </option>
    ));
};
