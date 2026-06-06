import {
    firstLetterUppercase,
    regionDisplayNames,
    replaceUnderscore,
} from "./helpers";
import type { GenomicForm } from "./types";

export const FilePreview = (file: File) => {
    return `${file.name}`;
};

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
