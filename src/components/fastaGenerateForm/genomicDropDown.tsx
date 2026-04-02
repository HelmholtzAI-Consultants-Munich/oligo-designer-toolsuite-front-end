import type { PropsWithChildren } from "react";
import { ToolTip } from "./tooltip";

interface GenomicDropDownProps {
    label: {
        htmlFor: string;
        text: string;
    };
    select: {
        value: string;
        nameAndId: string;
        handleChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => void;
    };
    tooltip?: {
        id: string;
        tip: string;
    };
}

export const GenomicDropDown: React.FC<
    PropsWithChildren<GenomicDropDownProps>
> = ({ label, select, tooltip, children }) => {
    return (
        <div className="col-md-3">
            <label htmlFor={label.htmlFor} className="form-label">
                {label.text}
            </label>
            <div className="d-flex align-items-center">
                <select
                    className="form-select"
                    id={select.nameAndId}
                    name={select.nameAndId}
                    value={select.value}
                    onChange={select.handleChange}
                >
                    {children}
                </select>
                {tooltip && <ToolTip id={tooltip.id} tip={tooltip.tip} />}
            </div>
        </div>
    );
};
