import type { PropsWithChildren } from "react";
import { ToolTip } from "./tooltip";
import { Form } from "react-bootstrap";

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
