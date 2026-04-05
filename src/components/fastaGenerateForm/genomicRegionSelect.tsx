import type form_Data_Ncbi from "../../forms/genomic_ncbi_form";
import { ToolTip } from "./tooltip";

interface GenomicRegionSelectProps {
    exon_exon_junction_block_size: typeof form_Data_Ncbi.exon_exon_junction_block_size;
    genomic_regions: typeof form_Data_Ncbi.genomic_regions;
    handleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => void;
}

export const GenomicRegionSelect: React.FC<GenomicRegionSelectProps> = ({
    exon_exon_junction_block_size,
    genomic_regions,
    handleChange,
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
                                id={region}
                                name={region}
                                checked={
                                    genomic_regions[region]?.value === "true"
                                }
                                onChange={handleChange}
                            />
                            <label
                                htmlFor={region}
                                className="form-check-label me-2 mb-0"
                            >
                                {["utr", "cds"].includes(region)
                                    ? region.toUpperCase()
                                    : region.charAt(0).toUpperCase() +
                                      region.slice(1).replace(/_/g, "-")}
                            </label>
                            <ToolTip
                                id={`popover-${region}`}
                                tip={genomic_regions[region].comment}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {/* Block size input for exon-exon junctions */}
            {genomic_regions.exon_exon_junction.value === "true" && (
                <div className="col-md-4 pt-2">
                    <label
                        htmlFor="exon_exon_junction_block_size"
                        className="form-label me-2 mb-0"
                    >
                        Block Size
                    </label>
                    <div className="d-flex align-items-center">
                        <input
                            type="number"
                            className="form-control"
                            id="exon_exon_junction_block_size"
                            name="exon_exon_junction_block_size"
                            value={exon_exon_junction_block_size.value}
                            onChange={handleChange}
                            placeholder="50"
                        />
                        <ToolTip
                            id="dir_output"
                            tip={exon_exon_junction_block_size.comment}
                        />
                    </div>
                </div>
            )}
        </>
    );
};
