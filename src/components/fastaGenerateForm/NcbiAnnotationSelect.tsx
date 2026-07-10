import { useCallback, useEffect, useState } from "react";
import { BACKEND_URL } from "../../config";
import axios from "axios";
import { getErrorMessage } from "../../utils/errorUtil";
import { GenomicDropDown } from "./GenomicDropDown";
import { useCache } from "../../hooks/useCache";
import type { NcbiAndEnsemblFormData } from "./types";

interface NcbiAnnotationSelectProps {
    id: string;
    value: string;
    tooltip?: string;
    form: NcbiAndEnsemblFormData;
    handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Dropdown Menu for selecting the annotation release for an Genomic Region Generator Form using NCBI as source
 *
 * Unlike the other Dropdown Menus, this one not only wraps the `GenomicDropDown` component, but also communicates with the server to
 * fetch the current annotation releases of a species on the fly.
 *
 * @param tooltip - explanation comment displayed, when hovering over the small info icon of the annotation release select menu
 * @param value - currently selected annotation release
 * @param handleChange - callback invoked to update the RJSF Form state, when the selected annotation release is changed
 * @param id - id of the `NcbiAnnotationSelect`
 * @param form - current state of the form data
 * @returns A React Component for selecting the annotation release, if `NCBI` is selected as source
 */
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

    const kingdom = form.formDataNcbi.source_params.taxon;
    const species = form.formDataNcbi.source_params.species;

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
                return data;
            } catch (err: unknown) {
                setError(
                    getErrorMessage(err, "Failed to load Annotation Releases")
                );
                console.error("Error fetching Annotation Releases:", err);
            } finally {
                setIsLoading(false);
            }
        },
        [cachedFetchAnnotationReleasesNCBI]
    );

    useEffect(() => {
        let ignore = false;
        updateAnnotationReleasesNCBI(species, kingdom).then((data) => {
            if (!ignore) {
                setReleases(data);
            } else {
                setIsLoading(true);
            }
        });
        return () => {
            ignore = true;
        };
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
