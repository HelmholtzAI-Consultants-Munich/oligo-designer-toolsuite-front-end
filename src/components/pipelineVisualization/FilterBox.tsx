import { Check, X } from "react-bootstrap-icons";
import { formatParameterName } from "./utils";

type ParameterObject = Record<string, unknown>;

type FilterBoxProps = {
    title: string;
    parameters: ParameterObject;
};

const FilterBox = ({ title, parameters }: FilterBoxProps) => {
    const disabled = parameters.enabled === false;

    return (
        <div className="position-relative p-3 mb-3 rounded-3 border">
            <div className={disabled ? "text-muted mb-2" : "fw-semibold mb-2 "}>
                {formatParameterName(title)}
            </div>
            <div className="parameter-status position-absolute top-0 end-0 me-2 mt-2">
                {disabled ? (
                    <X className="text-danger" />
                ) : (
                    <Check className="text-success" />
                )}
            </div>

            {Object.entries(parameters)
                .filter(([, value]) => value !== null)
                .filter(([title]) => title !== "enabled")
                .map(([k, val]) => {
                    //TODO: wenn nur ein val, dann nicht k anzeigen, weil da dann steht 0:
                    if (typeof val !== "object")
                        return (
                            <div
                                key={k}
                                className={
                                    disabled
                                        ? "d-flex justify-content-between gap-2 text-muted"
                                        : "d-flex justify-content-between gap-2 "
                                }
                            >
                                <span
                                    className="text-break"
                                    style={{ minWidth: 0 }}
                                >
                                    {formatParameterName(k)}:
                                </span>

                                <span
                                    className={`text-end ${
                                        typeof val === "number"
                                            ? "text-nowrap"
                                            : "text-break"
                                    }`}
                                >
                                    {String(val)}
                                </span>
                            </div>
                        );
                    else
                        return (
                            <FilterBox
                                title={k}
                                parameters={val as ParameterObject}
                            />
                        );
                })}
        </div>
    );
};

export default FilterBox;
