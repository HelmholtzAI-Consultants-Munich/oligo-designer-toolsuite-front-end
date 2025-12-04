import React from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import { handleChange } from "./helpers";
import type { formData } from "./types";

interface SelectOption {
    value: string;
    label: string;
}

interface SelectInputProps {
    label: string;
    id: string;
    options: SelectOption[];
    formData: formData;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

interface SelectInputAltProps {
    label: string;
    id: string;
    subId: string;
    options: SelectOption[];
    formData: formData;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

export const SelectInput: React.FC<SelectInputProps> = ({
    label, //display Name
    id, //internal identifier
    options = [],
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={id} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <select
                    className="form-select"
                    id={id}
                    name={id}
                    value={formData[id].value}
                    onChange={(e) => handleChange(e, setFormData)}
                >
                    {options.map((opt) => (
                        <option value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <OverlayTrigger
                    trigger="hover"
                    placement="top"
                    overlay={
                        <Popover id="popover-n_jobs">
                            <Popover.Body>{formData[id].comment}</Popover.Body>
                        </Popover>
                    }
                >
                    <InfoCircle
                        style={{
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            color: "#0d6efd",
                            marginLeft: "10px",
                        }}
                    />
                </OverlayTrigger>
            </div>
        </>
    );
};

export const SelectInputAlt: React.FC<SelectInputAltProps> = ({
    label, //display Name
    id, //internal identifier
    subId,
    options = [],
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={id} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <select
                    className="form-select"
                    id={`${id}.${subId}`}
                    name={`${id}.${subId}`}
                    value={formData[id][subId].value}
                    onChange={(e) => handleChange(e, setFormData)}
                >
                    {options.map((opt) => (
                        <option value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <OverlayTrigger
                    trigger="hover"
                    placement="top"
                    overlay={
                        <Popover id="popover-n_jobs">
                            <Popover.Body>
                                {formData[id][subId].comment}
                            </Popover.Body>
                        </Popover>
                    }
                >
                    <InfoCircle
                        style={{
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            color: "#0d6efd",
                            marginLeft: "10px",
                        }}
                    />
                </OverlayTrigger>
            </div>
        </>
    );
};
