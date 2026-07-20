import {
    firstLetterUppercase,
    regionDisplayNames,
    replaceUnderscore,
} from "./helpers";
import type { GenomicForm } from "./types";

export const FilePreview = (file: File) => {
    return `${file.name}`;
};

/**
 * Builds a summary that displays the current species and the selected regions, based on a Genomic Region Generator Form.
 * This summary is then used as a preview in the InputList.
 *
 * @param form - Genomic Region Generator Form that the preview is build for
 * @returns a short summary consisting of `"<species>: <selectedRegion1>, <selectedRegion2>, ..."`
 */
export const GenomicFormPreview = (form: GenomicForm) => {
    const species = replaceUnderscore(
        firstLetterUppercase(form.source_params.species)
    );
    const selectedRegions = Object.entries(form.genomic_regions)
        .filter(([, selected]) => selected === true)
        .map(
            ([key]) =>
                regionDisplayNames[key as keyof typeof regionDisplayNames]
        );

    return `${species}: ${selectedRegions.join(", ") || "no regions selected"}`;
};
