import React from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import { handleChange } from "./helpers";
import type { formData } from "./types";

interface TextInputProps {
    label: string;
    fieldID: string;
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

interface TextInputAltProps {
    label: string;
    fieldID: string;
    subID: string;
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

export const TextInput: React.FC<TextInputProps> = ({
    label, //display Name
    fieldID, //internal identifier
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={fieldID} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <input
                    type="text"
                    className="form-control"
                    id={fieldID}
                    name={fieldID}
                    value={formData[fieldID].value}
                    onChange={(e) => handleChange(e, setFormData)}
                    required
                />
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

export const TextInputAlt: React.FC<TextInputAltProps> = ({
    label, //display name
    fieldID, //internal identifier
    subID, //subname of the internal Id
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={fieldID} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <input
                    type="Text"
                    className="form-control"
                    id={`${fieldID}.${subID}`}
                    name={`${fieldID}.${subID}`}
                    value={formData[fieldID][subID].value}
                    onChange={(e) => handleChange(e, setFormData)}
                    required
                />
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
