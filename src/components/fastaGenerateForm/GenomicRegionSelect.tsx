import type { RJSFSchema } from "@rjsf/utils";
import { regionDisplayNames } from "./helpers";
import { ToolTip } from "./Tooltip";
import type { GenomicRegionsUncommented } from "./types";

interface GenomicRegionSelectProps {
    id: string;
    exon_exon_junction_block_size: string;
    genomic_regions: GenomicRegionsUncommented;
    handleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => void;
    schema: RJSFSchema;
}

export const GenomicRegionSelect: React.FC<GenomicRegionSelectProps> = ({
    id,
    exon_exon_junction_block_size,
    genomic_regions,
    handleChange,
    schema,
}) => {
    return (
        <>
            <h6 className="pt-3">Genomic Regions</h6>
            <div className="row g-3">
                {(
                    [
                        "gene",
                        "intergenic",
                        "exon",
                        "utr",
                        "cds",
                        "intron",
                        "exon_exon_junction",
                    ] as const
                ).map((region) => (
                    <div key={region} className="col-md-4">
                        <div className="d-flex align-items-center">
                            <input
                                type="checkbox"
                                className="form-check-input me-2"
                                id={`${region}-${id}`}
                                name={`genomic_regions.${region}`}
                                checked={genomic_regions[region] === "true"}
                                onChange={handleChange}
                            />
                            <label
                                htmlFor={`${region}-${id}`}
                                className="form-check-label me-2 mb-0"
                            >
                                {regionDisplayNames[region]}
                            </label>
                            <ToolTip
                                id={`popover-${region}-${id}`}
                                tip={
                                    schema.genomic_regions[region]
                                        .description ?? ""
                                }
                            />
                        </div>
                    </div>
                ))}
            </div>
            {/* Block size input for exon-exon junctions */}
            {genomic_regions.exon_exon_junction === "true" && (
                <div className="col-md-4 pt-2">
                    <label
                        htmlFor={`exon_exon_junction_block_size-${id}`}
                        className="form-label me-2 mb-0"
                    >
                        Block Size
                    </label>
                    <div className="d-flex align-items-center">
                        <input
                            type="number"
                            className="form-control"
                            id={`exon_exon_junction_block_size-${id}`}
                            name="exon_exon_junction_block_size"
                            value={exon_exon_junction_block_size}
                            onChange={handleChange}
                            placeholder="50"
                        />
                        <ToolTip
                            id={`dir_output-${id}`}
                            tip={
                                schema.exon_exon_junction_block_size
                                    .description ?? ""
                            }
                        />
                    </div>
                </div>
            )}
        </>
    );
};
