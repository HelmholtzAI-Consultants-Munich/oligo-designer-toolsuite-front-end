//
import { Check, X } from "react-bootstrap-icons";
import { formatParameterName, parseFastaFilePath } from "./utils";

type ParameterObject = Record<string, unknown>;

type FilterBoxProps = {
    title: string;
    parameters: ParameterObject;
};

const FASTA_TITLE_PREFIX = "files_fasta";
const REGION_ID_TITLE_PREFIX = "region_ids";
const FASTA_DISPLAY_KEYS = ["source", "species", "annotation_release"] as const;

const isPlainObject = (value: unknown): value is ParameterObject =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const cx = (...classes: Array<string | false | undefined>) =>
    classes.filter(Boolean).join(" ");

const FilterBox = ({ title, parameters }: FilterBoxProps) => {
    const disabled = parameters.enabled === false;
    const isFastaFile = title.startsWith(FASTA_TITLE_PREFIX);
    const isRegionId = title.startsWith(REGION_ID_TITLE_PREFIX);

    const renderFastaEntry = (key: string, val: unknown) =>
        Object.entries(parseFastaFilePath(String(val)))
            .filter(([entryKey]) =>
                (FASTA_DISPLAY_KEYS as readonly string[]).includes(entryKey)
            )
            .map(([entryKey, entryValue]) => (
                <div
                    key={entryKey}
                    className="d-flex justify-content-between gap-2"
                >
                    <span>{formatParameterName(entryKey)}</span>
                    <span className="text-end text-break">
                        {formatParameterName(String(entryValue))}
                    </span>
                </div>
            ));

    const renderValueEntry = (key: string, val: unknown) => (
        <div
            key={key}
            className={cx(
                "d-flex justify-content-between gap-2",
                disabled && "text-muted"
            )}
        >
            <span className="text-break" style={{ minWidth: 0 }}>
                {isRegionId ? String(val) : `${formatParameterName(key)}:`}
            </span>
            <span
                className={cx(
                    "text-end",
                    typeof val === "number" ? "text-nowrap" : "text-break"
                )}
            >
                {isRegionId ? "" : String(val)}
            </span>
        </div>
    );

    const entries = Object.entries(parameters).filter(
        ([key, value]) => value !== null && key !== "enabled"
    );

    return (
        <div className="position-relative p-3 mb-3 rounded-3 border">
            <div
                className={cx(disabled ? "text-muted" : "fw-semibold", "mb-2")}
            >
                {formatParameterName(title)}
            </div>

            <div className="parameter-status position-absolute top-0 end-0 me-2 mt-2">
                <span role="img" aria-label={disabled ? "disabled" : "enabled"}>
                    {disabled ? (
                        <X className="text-danger" />
                    ) : (
                        <Check className="text-success" />
                    )}
                </span>
            </div>

            {entries.length === 0 && (
                <div className="text-muted fst-italic">No parameters</div>
            )}

            {entries.map(([key, val]) => {
                if (isPlainObject(val)) {
                    return <FilterBox key={key} title={key} parameters={val} />;
                }
                if (isFastaFile) {
                    return renderFastaEntry(key, val);
                }
                return renderValueEntry(key, val);
            })}
        </div>
    );
};

export default FilterBox;
