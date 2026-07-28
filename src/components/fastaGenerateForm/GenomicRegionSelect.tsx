import { regionDisplayNames } from "./helpers";
import type { GenomicRegionsForm } from "./types";

interface GenomicRegionSelectProps {
    id: string;
    exon_exon_junction_block_size: number;
    genomic_regions: GenomicRegionsForm;
    handleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => void;
}

/**
 * Displays the genomic region checkboxes (e.g. exon, intron) used to configure the Genomic Region Generator.
 *
 * @param id - unique ID of the component
 * @param exon_exon_junction_block_size - current value of the exon_exon_junction_block_size
 * @param genomic_regions - current state of the genomic_regions checkboxes
 * @param handleChange - callback invoked to update the RJSF Form state, when the selected genomic regions or the Exon-Exon-Junction block site is changed
 * @returns A React Component that allows for selecting genomic regions
 */
export const GenomicRegionSelect: React.FC<GenomicRegionSelectProps> = ({
    id,
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
                                id={`${region}-${id}`}
                                name={`genomic_regions.${region}`}
                                checked={genomic_regions[region] === true}
                                onChange={handleChange}
                            />
                            <label
                                htmlFor={`${region}-${id}`}
                                className="form-check-label me-2 mb-0"
                            >
                                {regionDisplayNames[region]}
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            {/* Block size input for exon-exon junctions */}
            {genomic_regions.exon_exon_junction === true && (
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
                    </div>
                </div>
            )}
        </>
    );
};
