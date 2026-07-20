import { GenomicDropDown } from "./GenomicDropDown";
import type { NcbiAndEnsemblFormData } from "./types";

interface SourceSelectProps {
    id: string;
    form: NcbiAndEnsemblFormData;
    onChange: (newForm: NcbiAndEnsemblFormData) => void;
}

/**
 * Renders a dropdown for selecting the genomic data source.
 *
 * This component displays a selector that allows the user to choose between
 * supported genomic data providers (NCBI and Ensembl). When the selection
 * changes, it updates the `selectedSource` field in the provided form data
 * and passes the updated form object to the `onChange` callback.
 *
 * @param id - unique ID applied to the underlying dropdown element.
 * @param form - The current form data containing the selected source.
 * @param onChange - callback invoked to update the RJSF Form state, when the selected genomic data provider is changed
 * @returns A React Component for selecting the genomic data source.
 */
export const SourceSelect: React.FC<SourceSelectProps> = ({
    id,
    form,
    onChange,
}) => {
    // Handles changes to the source selector (NCBI/Ensembl)
    const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSource = e.target.value;
        onChange({
            ...form,
            selectedSource:
                newSource as NcbiAndEnsemblFormData["selectedSource"],
        });
    };

    return (
        <GenomicDropDown
            id={id}
            label="Select Source"
            nameAndId="source"
            value={form.selectedSource}
            handleChange={handleSourceChange}
        >
            <option key={"ncbi"} value="ncbi">
                {" "}
                NCBI
            </option>
            <option key={"ensembl"} value="ensembl">
                {" "}
                Ensembl
            </option>
        </GenomicDropDown>
    );
};
