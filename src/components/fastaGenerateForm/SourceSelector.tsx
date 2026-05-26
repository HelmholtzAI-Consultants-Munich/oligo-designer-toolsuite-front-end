import { GenomicDropDown } from "./GenomicDropDown";
import type { FastaFormUncommented } from "./types";

interface SourceSelectProps {
    id: string;
    form: FastaFormUncommented;
    onChange: (newForm: FastaFormUncommented) => void;
}

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
            selectedSource: newSource,
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
