import { useCallback, useEffect, useState } from "react";
import { BACKEND_URL } from "../../config";
import axios from "axios";
import type { FastaForm } from "./types";
import { GenomicDropDown } from "./GenomicDropDown";
import { useCache } from "../../hooks/useCache";

interface NcbiAnnotationSelectProps {
    id: string;
    value: string;
    tooltip?: string;
    form: FastaForm;
    handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const NcbiAnnotationSelect: React.FC<NcbiAnnotationSelectProps> = ({
    tooltip,
    value,
    handleChange,
    id,
    form,
}) => {
    const { cached } = useCache();
    const [releases, setReleases] = useState<string[]>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const kingdom = form.formDataNcbi.source_params.taxon.value;
    const species = form.formDataNcbi.source_params.species.value;

    const fetchAnnotationReleasesNCBI = async (
        species: string,
        kingdom: string
    ) => {
        const DROPDOWN_URL =
            BACKEND_URL + `/api/genomic/releases/${kingdom}/${species}`;
        const response = await axios.get(DROPDOWN_URL, {
            withCredentials: true,
        });
        return response.data as string[];
    };

    const cachedFetchAnnotationReleasesNCBI = cached(
        fetchAnnotationReleasesNCBI
    );

    const updateAnnotationReleasesNCBI = useCallback(
        async (species: string, kingdom: string) => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await cachedFetchAnnotationReleasesNCBI(
                    species,
                    kingdom
                );
                setReleases(data);
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
        [cachedFetchAnnotationReleasesNCBI]
    );

    useEffect(() => {
        updateAnnotationReleasesNCBI(species, kingdom);
    }, [species, kingdom, updateAnnotationReleasesNCBI]);

    const Options = () => {
        if (isLoading) {
            return (
                <>
                    <option>Loading annotation releases...</option>
                    {value !== "" && <option value={value}>{value}</option>}
                </>
            );
        }

        if (error || !releases) {
            return <option>Error while loading annotation releases!</option>;
        }

        return (
            <>
                <option value="">Select a release</option>
                {releases.map((release, idx) => (
                    <option key={idx} value={release}>
                        {release}
                    </option>
                ))}
            </>
        );
    };

    return (
        <GenomicDropDown
            id={id}
            label="Annotation Release"
            nameAndId="source_params.annotation_release"
            tooltip={tooltip}
            value={value}
            handleChange={handleChange}
        >
            <Options />
        </GenomicDropDown>
    );
};
