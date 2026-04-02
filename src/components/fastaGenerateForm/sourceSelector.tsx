import type { FastaForm } from "../types";
import { GenomicDropDown } from "./genomicDropDown";
import { GenomicRegionSelect } from "./genomicRegionSelect";

interface SourceSelectProps {
    form: FastaForm;
    onChange: (newForm: FastaForm) => void;
}

export const SourceSelect: React.FC<SourceSelectProps> = ({
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
            label={{
                htmlFor: "source",
                text: "Select Source",
            }}
            select={{
                nameAndId: "source",
                value: form.selectedSource,
                handleChange: handleSourceChange,
            }}
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
