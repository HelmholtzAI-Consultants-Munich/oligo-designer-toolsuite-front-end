import React from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import { handleChange } from "./helpers";
import type { formData } from "./types";

interface NumberInputProps {
    label: string;
    id: string;
    formData: formData;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

interface NumberInputAltProps {
    label: string;
    id: string;
    subId: string;
    formData: formData;
    setFormData: React.Dispatch<React.SetStateAction<formData>>;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    label, //display Name
    id, //internal identifier
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={id} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <input
                    type="number"
                    className="form-control"
                    id={id}
                    name={id}
                    value={formData[id].value}
                    onChange={(e) => handleChange(e, setFormData)}
                    required
                />
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

export const NumberInputAlt: React.FC<NumberInputAltProps> = ({
    label, //display name
    id, //internal identifier
    subId, //subname of the internal Id
    formData,
    setFormData,
}) => {
    return (
        <>
            <label htmlFor={id} className={"form-label"}>
                {label}
            </label>
            <div className="d-flex align-items-center">
                <input
                    type="number"
                    className="form-control"
                    id={`${id}.${subId}`}
                    name={`${id}.${subId}`}
                    value={formData[id][subId].value}
                    onChange={(e) => handleChange(e, setFormData)}
                    required
                />
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
