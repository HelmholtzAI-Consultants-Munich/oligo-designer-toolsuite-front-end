import type { FastaForm } from "../types";
import { replaceUnderscore } from "./helpers";
import type { DropDown } from "./types";

interface DropDownOptionProps {
    form: FastaForm;
    handleNcbiChange: any;
    dropDown: DropDown;
}

export const DropDownOption: React.FC<DropDownOptionProps> = ({
    form,
    handleNcbiChange,
    dropDown,
}) => {
    return (
        <select
            name="source_params.species"
            className="form-select"
            id="source_params.species"
            value={form.formDataNcbi.source_params.species.value}
            onChange={handleNcbiChange}
        >
            <option value="">Select a species</option>
            {dropDown.ncbi
                ?.get(
                    form.formDataNcbi.source_params.taxon.value.toLowerCase()
                )!
                .map((entry) => (
                    <option key={entry} value={entry}>
                        {replaceUnderscore(entry)}
                    </option>
                ))}
        </select>
    );
};
