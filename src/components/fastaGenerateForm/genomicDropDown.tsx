import type { PropsWithChildren } from "react";
import { ToolTip } from "./tooltip";

interface GenomicSelectProps {
    value: string;
    tooltip?: string;
    handleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => void;
}

interface GenomicDropDownProps extends GenomicSelectProps {
    labelHtmlFor: string;
    label: string;
    nameAndId: string;
}

export const GenomicDropDown: React.FC<
    PropsWithChildren<GenomicDropDownProps>
> = ({
    label,
    labelHtmlFor,
    value,
    nameAndId,
    handleChange,
    tooltip,
    children,
}) => {
    return (
        <div className="col-md-3">
            <label htmlFor={labelHtmlFor} className="form-label">
                {label}
            </label>
            <div className="d-flex align-items-center">
                <select
                    className="form-select"
                    id={nameAndId}
                    name={nameAndId}
                    value={value}
                    onChange={handleChange}
                >
                    {children}
                </select>
                {tooltip && <ToolTip id={"dir_output"} tip={tooltip} />}
            </div>
        </div>
    );
};

export const SpeciesSelect: React.FC<PropsWithChildren<GenomicSelectProps>> = ({
    tooltip,
    value,
    handleChange,
    children,
}) => {
    return (
        <GenomicDropDown
            label="Species"
            labelHtmlFor="species"
            nameAndId="source_params.species"
            tooltip={tooltip}
            value={value}
            children={children}
            handleChange={handleChange}
        />
    );
};

export const TaxonSelect: React.FC<PropsWithChildren<GenomicSelectProps>> = ({
    tooltip,
    value,
    handleChange,
    children,
}) => {
    return (
        <GenomicDropDown
            label="Taxon"
            labelHtmlFor="taxon"
            nameAndId="source_params.taxon"
            tooltip={tooltip}
            value={value}
            children={children}
            handleChange={handleChange}
        />
    );
};

export const AnnotationSelect: React.FC<
    PropsWithChildren<GenomicSelectProps>
> = ({ tooltip, value, handleChange, children }) => {
    return (
        <GenomicDropDown
            label="Annotation Release"
            labelHtmlFor="annotation_release"
            nameAndId="source_params.annotation_release"
            tooltip={tooltip}
            value={value}
            children={children}
            handleChange={handleChange}
        />
    );
};
