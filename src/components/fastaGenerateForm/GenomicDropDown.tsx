import type { PropsWithChildren } from "react";
import { Form } from "react-bootstrap";
import { ToolTip } from "../ui/Tooltip";

interface GenomicSelectProps {
    id: string;
    value: string;
    tooltip?: string;
    handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

interface GenomicDropDownProps extends GenomicSelectProps {
    label: string;
    nameAndId: string;
}

/**
 * Base Component for all Dropdown Menus used in the Genomic Region Generator Form
 *
 * @param label - Label of the dropdown menu
 * @param value - currently selected value of the dropdown menu
 * @param nameAndId - name and Id of the dropdown menu, to allow matching the label to the select component.
 * It is used to differentiate the different wrapped version of the Genomic Dropdown component based on a combination of nameAndId + id, because the id is the
 * same for every Genomic Dropdown in one Genomic Region Generator Form
 * @param handleChange - callback invoked to update the RJSF Form state, when the selected dropdown value is changed
 * @param tooltip - explanation comment displayed, when hovering over the small info icon of the dropdown menu
 * @param children - selectable options of the dropdown menu
 * @param id - unique ID of the component
 * @returns A React Component that is overwritten by the specific Genomic Dropdown Menus
 */
export const GenomicDropDown: React.FC<
    PropsWithChildren<GenomicDropDownProps>
> = ({ label, value, nameAndId, handleChange, tooltip, children, id }) => {
    return (
        <div className="col-md-3">
            <Form.Label htmlFor={`${nameAndId}-${id}`}>{label}</Form.Label>
            <div className="d-flex align-items-center">
                <Form.Select
                    id={`${nameAndId}-${id}`}
                    name={nameAndId}
                    value={value}
                    onChange={handleChange}
                >
                    {children}
                </Form.Select>
                {tooltip && <ToolTip id={`${nameAndId}-${id}`} tip={tooltip} />}
            </div>
        </div>
    );
};

/**
 * Dropdown Menu to select a species.
 * It wraps the `GenomicDropDown` component and overwrites the `label` and `nameAndId` props, since they are the same for all
 * `SpeciesSelect` menus.
 *
 * @param value - currently selected species
 * @param handleChange - callback invoked to update the RJSF Form state, when the selected species is changed
 * @param tooltip - explanation comment displayed, when hovering over the small info icon of the species select menu
 * @param children - selectable options of the dropdown menu
 * @param id - unique ID of the underlying GenomicDropDown
 * @returns A React Component that serves as a species dropdown
 */
export const SpeciesSelect: React.FC<PropsWithChildren<GenomicSelectProps>> = ({
    tooltip,
    value,
    handleChange,
    children,
    id,
}) => {
    return (
        <GenomicDropDown
            id={id}
            label="Species"
            nameAndId="source_params.species"
            tooltip={tooltip}
            value={value}
            children={children}
            handleChange={handleChange}
        />
    );
};

/**
 * Dropdown Menu to select the taxon.
 * It wraps the `GenomicDropDown` component and overwrites the `label` and `nameAndId` props, since they are the same for all
 * `TaxonSelect` menus.
 *
 * @param value - selected taxon
 * @param handleChange - callback invoked to update the RJSF Form state, when the selected species is changed
 * @param tooltip - explanation comment displayed, when hovering over the small info icon of the taxon select menu
 * @param children - selectable options of the dropdown menu
 * @param id - unique ID of the underlying GenomicDropDown
 * @returns A React Component that serves as a taxon dropdown
 */
export const TaxonSelect: React.FC<PropsWithChildren<GenomicSelectProps>> = ({
    tooltip,
    value,
    handleChange,
    children,
    id,
}) => {
    return (
        <GenomicDropDown
            id={id}
            label="Taxon"
            nameAndId="source_params.taxon"
            tooltip={tooltip}
            value={value}
            children={children}
            handleChange={handleChange}
        />
    );
};

/**
 * Dropdown Menu to select annotation release.
 * It wraps the `GenomicDropDown` component and overwrites the `label` and `nameAndId` props, since they are the same for all
 * `AnnotationSelect` menus.
 *
 * @param value - selected annotation release
 * @param handleChange - callback invoked, when the selected annotation is changed, to update the RJSF Form State
 * @param tooltip - explanation comment displayed, when hovering over the small info icon of the annotation release select menu
 * @param children - selectable options of the dropdown menu
 * @param id - unique ID of the underlying GenomicDropDown
 * @returns A React Component that serves as a annotation release dropdown
 */
export const AnnotationSelect: React.FC<
    PropsWithChildren<GenomicSelectProps>
> = ({ tooltip, value, handleChange, children, id }) => {
    return (
        <GenomicDropDown
            id={id}
            label="Annotation Release"
            nameAndId="source_params.annotation_release"
            tooltip={tooltip}
            value={value}
            children={children}
            handleChange={handleChange}
        />
    );
};
