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
    fieldID: string;
    options: SelectOption[];
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

interface SelectInputAltProps {
    label: string;
    fieldID: string;
    subID: string;
    options: SelectOption[];
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

export const SelectInput: React.FC<SelectInputProps> = ({
    label, //display Name
    fieldID, //internal identifier
    options = [],
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={fieldID} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <select
                    className="form-select"
                    id={fieldID}
                    name={fieldID}
                    value={formData[fieldID].value}
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
                                {formData[fieldID].comment}
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

export const SelectInputAlt: React.FC<SelectInputAltProps> = ({
    label, //display Name
    fieldID, //internal identifier
    subID,
    options = [],
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={fieldID} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <select
                    className="form-select"
                    id={`${fieldID}.${subID}`}
                    name={`${fieldID}.${subID}`}
                    value={formData[fieldID][subID].value}
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
                                {formData[fieldID][subID].comment}
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

//  <SelectInput
//     label="Heuristic:"
//     fieldID="heuristic"
//     options= {[
//         { value: "true", label: "True" },
//         { value: "false", label: "False" }
//       ]}
//     formData={formData}
//     setFormData={setFormData}
// />
