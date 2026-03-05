/**
 * FastaGenerateForm.tsx
 *
 * This component renders a form to generate FASTA files from NCBI or Ensembl sources.
 * It allows users to select the data source, species, taxon, annotation release, genomic regions, and additional options.
 * The form is controlled via props and notifies parent components of changes.
 */
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import {
    archaeaEntries,
    fungiEntries,
    invertebrateEntries,
    mitochondrionEntries,
    plantEntries,
    plasmidEntries,
    plastidEntries,
    protozoaEntries,
    unknownEntries,
    vertebrate_mammalianEntries,
    vertebrate_otherEntries,
} from "../forms/refseqSpecies";
import { ensemblSpecies } from "../forms/ensemblSpecies";
import { ncbiAnnotationReleases } from "../forms/ncbiAnnotationReleases";
import type { FastaForm } from "../types";

// Props for FastaGenerateForm, containing current form state and handlers for change/removal.
interface FastaGenerateFormProps {
    form: FastaForm;
    onChange: (newForm: FastaForm) => void;
    onRemove?: () => void;
    disableRemove?: boolean;
}

/**
 * FastaGenerateForm
 *
 * Renders a dynamic form for FASTA file generation, switching between NCBI and Ensembl options.
 * Handles all controlled input changes and notifies parent components of updates.
 */
const FastaGenerateForm: React.FC<FastaGenerateFormProps> = ({
    form,
    onChange,
    onRemove,
    disableRemove,
}) => {
    // Handles changes to the source selector (NCBI/Ensembl)
    const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSource = e.target.value;
        onChange({
            ...form,
            selectedSource: newSource,
        });
    };

    // Handles changes to NCBI-specific form fields and checkboxes
    const handleNcbiChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        const checked =
            "checked" in e.target
                ? (e.target as HTMLInputElement).checked
                : false;
        // Checkboxes for genomic regions
        if (name in form.formDataNcbi.genomic_regions) {
            const key = name as keyof typeof form.formDataNcbi.genomic_regions;
            const newGenomicRegions = {
                ...form.formDataNcbi.genomic_regions,
                [key]: {
                    ...form.formDataNcbi.genomic_regions[key],
                    value: checked ? "true" : "false",
                },
            };
            onChange({
                ...form,
                formDataNcbi: {
                    ...form.formDataNcbi,
                    genomic_regions: newGenomicRegions,
                },
            });
            return;
        }
        if (name === "exon_exon_junction_block_size") {
            onChange({
                ...form,
                formDataNcbi: {
                    ...form.formDataNcbi,
                    exon_exon_junction_block_size: {
                        ...form.formDataNcbi.exon_exon_junction_block_size,
                        value: value,
                    },
                },
            });
            return;
        }
        // Nested source_params
        if (name.startsWith("source_params.")) {
            const key = name.split(
                "."
            )[1] as keyof typeof form.formDataNcbi.source_params;
            onChange({
                ...form,
                formDataNcbi: {
                    ...form.formDataNcbi,
                    source_params: {
                        ...form.formDataNcbi.source_params,
                        [key]: {
                            ...form.formDataNcbi.source_params[key],
                            value: value,
                        },
                    },
                },
            });
            return;
        }
    };

    // Handles changes to Ensembl-specific form fields and checkboxes
    const handleEnsChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        const checked =
            "checked" in e.target
                ? (e.target as HTMLInputElement).checked
                : false;
        if (name in form.formDataEns.genomic_regions) {
            const key = name as keyof typeof form.formDataEns.genomic_regions;
            const newGenomicRegions = {
                ...form.formDataEns.genomic_regions,
                [key]: {
                    ...form.formDataEns.genomic_regions[key],
                    value: checked ? "true" : "false",
                },
            };
            onChange({
                ...form,
                formDataEns: {
                    ...form.formDataEns,
                    genomic_regions: newGenomicRegions,
                },
            });
            return;
        }
        if (name === "exon_exon_junction_block_size") {
            onChange({
                ...form,
                formDataEns: {
                    ...form.formDataEns,
                    exon_exon_junction_block_size: {
                        ...form.formDataEns.exon_exon_junction_block_size,
                        value: value,
                    },
                },
            });
            return;
        }
        // Nested source_params
        if (name.startsWith("source_params.")) {
            const key = name.split(
                "."
            )[1] as keyof typeof form.formDataEns.source_params;
            onChange({
                ...form,
                formDataEns: {
                    ...form.formDataEns,
                    source_params: {
                        ...form.formDataEns.source_params,
                        [key]: {
                            ...form.formDataEns.source_params[key],
                            value: value,
                        },
                    },
                },
            });
            return;
        }
    };

    return (
        <div className="border border-primary rounded p-3 mb-3 bg-white">
            <div className="d-flex align-items-center ">
                <div className="col-md-8">
                    <div>
                        {form.selectedSource === "ncbi" && (
                            <div>
                                {/* Source selector */}
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label
                                            htmlFor="source"
                                            className="form-label"
                                        >
                                            Select Source
                                        </label>
                                        <select
                                            className="form-select"
                                            id="source"
                                            name="source"
                                            value={form.selectedSource}
                                            onChange={handleSourceChange}
                                        >
                                            <option value="ncbi"> NCBI</option>
                                            <option value="ensembl">
                                                {" "}
                                                Ensembl
                                            </option>
                                        </select>
                                    </div>
                                    {/* Taxon selector */}
                                    <div className="col-md-3">
                                        <label
                                            htmlFor="taxon"
                                            className="form-label"
                                        >
                                            Taxon
                                        </label>
                                        <div className="d-flex align-items-center">
                                            <select
                                                className="form-select"
                                                id="source_params.taxon"
                                                name="source_params.taxon"
                                                value={
                                                    form.formDataNcbi
                                                        .source_params.taxon
                                                        .value
                                                }
                                                onChange={handleNcbiChange}
                                            >
                                                <option value="vertebrate_mammalian">
                                                    Vertebrate Mammalian
                                                </option>
                                                <option value="archaea">
                                                    Archaea
                                                </option>
                                                <option value="bacteria">
                                                    Bacteria
                                                </option>
                                                <option value="fungi">
                                                    Fungi
                                                </option>
                                                <option value="invertebrate">
                                                    Invertebrate
                                                </option>
                                                <option value="metagenomes">
                                                    Metagenomes
                                                </option>
                                                <option value="mitochondrion">
                                                    Mitochondrion
                                                </option>
                                                <option value="plant">
                                                    Plant
                                                </option>
                                                <option value="plasmid">
                                                    Plasmid
                                                </option>
                                                <option value="plastid">
                                                    Plastid
                                                </option>
                                                <option value="protozoa">
                                                    Protozoa
                                                </option>
                                                <option value="unknown">
                                                    Unknown
                                                </option>
                                                <option value="vertebrate_other">
                                                    Vertebrate Other
                                                </option>
                                                <option value="viral">
                                                    Viral
                                                </option>
                                            </select>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form
                                                                    .formDataNcbi
                                                                    .source_params
                                                                    .taxon
                                                                    .comment
                                                            }
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
                                    </div>

                                    {/* Species selector */}
                                    <div className="col-md-3">
                                        <label
                                            htmlFor="species"
                                            className="form-label"
                                        >
                                            Species
                                        </label>
                                        <div className="d-flex align-items-center">
                                            {form.formDataNcbi.source_params
                                                .taxon.value ===
                                            "vertebrate_mammalian" ? (
                                                <select
                                                    name="source_params.species"
                                                    className="form-select"
                                                    id="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {vertebrate_mammalianEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "archaea" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {archaeaEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value ===
                                              "bacteria" ? (
                                                <select
                                                    className="form-control"
                                                    id="species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "fungi" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {fungiEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value ===
                                              "invertebrate" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {invertebrateEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value ===
                                              "mitochondrion" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {mitochondrionEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "plant" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {plantEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "plasmid" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    {plasmidEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "plastid" ? (
                                                <select
                                                    className="form-control"
                                                    id="species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {plastidEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value ===
                                              "protozoa" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {protozoaEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "unknown" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {unknownEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value ===
                                              "vertebrate_other" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    name="source_params.species"
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                    {vertebrate_otherEntries.map(
                                                        (entry) => (
                                                            <option
                                                                key={entry}
                                                                value={entry}
                                                            >
                                                                {entry}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            ) : form.formDataNcbi.source_params
                                                  .taxon.value === "viral" ? (
                                                <select
                                                    className="form-control"
                                                    id="source_params.species"
                                                    name="source_params.species"
                                                    value={
                                                        form.formDataNcbi
                                                            .source_params
                                                            .species.value
                                                    }
                                                    onChange={handleNcbiChange}
                                                >
                                                    <option value="">
                                                        Select a species
                                                    </option>
                                                </select>
                                            ) : null}
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form
                                                                    .formDataNcbi
                                                                    .source_params
                                                                    .species
                                                                    .comment
                                                            }
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
                                    </div>

                                    {/* Annotation release selector */}
                                    <div className="col-md-3">
                                        <label
                                            htmlFor="annotation_release"
                                            className="form-label"
                                        >
                                            Annotation Release
                                        </label>
                                        <div className="d-flex align-items-center">
                                            <select
                                                className="form-select"
                                                id="source_params.annotation_release"
                                                name="source_params.annotation_release"
                                                value={
                                                    form.formDataNcbi
                                                        .source_params
                                                        .annotation_release
                                                        .value
                                                }
                                                onChange={handleNcbiChange}
                                            >
                                                <option value="">
                                                    Select a release
                                                </option>
                                                {ncbiAnnotationReleases.map(
                                                    (release) => (
                                                        <option
                                                            key={release}
                                                            value={release}
                                                        >
                                                            {release}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form
                                                                    .formDataNcbi
                                                                    .source_params
                                                                    .annotation_release
                                                                    .comment
                                                            }
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
                                    </div>
                                </div>

                                {/* Genomic regions checkboxes */}
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
                                                        form.formDataNcbi
                                                            .genomic_regions[
                                                            region
                                                        ]?.value === "true"
                                                    }
                                                    onChange={handleNcbiChange}
                                                />
                                                <label
                                                    htmlFor={region}
                                                    className="form-check-label me-2 mb-0"
                                                >
                                                    {["utr", "cds"].includes(
                                                        region
                                                    )
                                                        ? region.toUpperCase()
                                                        : region
                                                              .charAt(0)
                                                              .toUpperCase() +
                                                          region
                                                              .slice(1)
                                                              .replace(
                                                                  /_/g,
                                                                  "-"
                                                              )}
                                                </label>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover
                                                            id={`popover-${region}`}
                                                        >
                                                            <Popover.Body>
                                                                {
                                                                    form
                                                                        .formDataNcbi
                                                                        .genomic_regions[
                                                                        region
                                                                    ].comment
                                                                }
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle
                                                        style={{
                                                            fontSize: "1.2rem",
                                                            cursor: "pointer",
                                                            color: "#0d6efd",
                                                        }}
                                                    />
                                                </OverlayTrigger>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Block size input for exon-exon junctions */}
                                {form.formDataNcbi.genomic_regions
                                    .exon_exon_junction.value === "true" && (
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
                                                value={
                                                    form.formDataNcbi
                                                        .exon_exon_junction_block_size
                                                        .value
                                                }
                                                onChange={handleNcbiChange}
                                                placeholder="50"
                                            />
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form
                                                                    .formDataNcbi
                                                                    .exon_exon_junction_block_size
                                                                    .comment
                                                            }
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
                                    </div>
                                )}

                                {/* Removed <form> wrapper, handled in parent */}
                            </div>
                        )}
                        {form.selectedSource === "ensembl" && (
                            <div>
                                {/* Source selector */}
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label
                                            htmlFor="source"
                                            className="form-label"
                                        >
                                            Select Source
                                        </label>
                                        <select
                                            className="form-select"
                                            id="source"
                                            name="source"
                                            value={form.selectedSource}
                                            onChange={handleSourceChange}
                                        >
                                            <option value="ncbi"> NCBI</option>
                                            <option value="ensembl">
                                                {" "}
                                                Ensembl
                                            </option>
                                        </select>
                                    </div>
                                    {/* Species selector */}
                                    <div className="col-md-4">
                                        <label
                                            htmlFor="species"
                                            className="form-label"
                                        >
                                            Species
                                        </label>
                                        <div className="d-flex align-items-center">
                                            <select
                                                className="form-select"
                                                id="source_params.species"
                                                name="source_params.species"
                                                value={
                                                    form.formDataEns
                                                        .source_params.species
                                                        .value
                                                }
                                                onChange={handleEnsChange}
                                            >
                                                {ensemblSpecies.map((entry) => (
                                                    <option
                                                        key={entry}
                                                        value={entry}
                                                    >
                                                        {entry}
                                                    </option>
                                                ))}
                                            </select>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form.formDataEns
                                                                    .source_params
                                                                    .species
                                                                    .comment
                                                            }
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
                                    </div>

                                    {/* Annotation release selector */}
                                    <div className="col-md-4">
                                        <label
                                            htmlFor="annotation_release"
                                            className="form-label"
                                        >
                                            Annotation Release
                                        </label>
                                        <div className="d-flex align-items-center">
                                            <select
                                                className="form-select"
                                                id="source_params.annotation_release"
                                                name="source_params.annotation_release"
                                                value={
                                                    form.formDataEns
                                                        .source_params
                                                        .annotation_release
                                                        .value
                                                }
                                                onChange={handleEnsChange}
                                            >
                                                <option value="">
                                                    Select a release
                                                </option>
                                                {ncbiAnnotationReleases.map(
                                                    (release) => (
                                                        <option
                                                            key={release}
                                                            value={release}
                                                        >
                                                            {release}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form.formDataEns
                                                                    .source_params
                                                                    .annotation_release
                                                                    .comment
                                                            }
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
                                    </div>
                                </div>

                                {/* Genomic regions checkboxes */}
                                <h5 className="pt-3">Genomic Regions</h5>
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
                                                        form.formDataEns
                                                            .genomic_regions[
                                                            region
                                                        ]?.value === "true"
                                                    }
                                                    onChange={handleEnsChange}
                                                />
                                                <label
                                                    htmlFor={region}
                                                    className="form-check-label me-2 mb-0"
                                                >
                                                    {["utr", "cds"].includes(
                                                        region
                                                    )
                                                        ? region.toUpperCase()
                                                        : region
                                                              .charAt(0)
                                                              .toUpperCase() +
                                                          region
                                                              .slice(1)
                                                              .replace(
                                                                  /_/g,
                                                                  "-"
                                                              )}
                                                </label>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover
                                                            id={`popover-${region}`}
                                                        >
                                                            <Popover.Body>
                                                                {
                                                                    form
                                                                        .formDataEns
                                                                        .genomic_regions[
                                                                        region as keyof typeof form.formDataEns.genomic_regions
                                                                    ].comment
                                                                }
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle
                                                        style={{
                                                            fontSize: "1.2rem",
                                                            cursor: "pointer",
                                                            color: "#0d6efd",
                                                        }}
                                                    />
                                                </OverlayTrigger>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Block size input for exon-exon junctions */}
                                {form.formDataEns.genomic_regions
                                    .exon_exon_junction.value === "true" && (
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
                                                value={
                                                    form.formDataEns
                                                        .exon_exon_junction_block_size
                                                        .value
                                                }
                                                onChange={handleEnsChange}
                                                placeholder="50"
                                            />
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="dir_output">
                                                        <Popover.Body>
                                                            {
                                                                form.formDataEns
                                                                    .exon_exon_junction_block_size
                                                                    .comment
                                                            }
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
                                    </div>
                                )}

                                {/* Removed <form> wrapper, handled in parent */}
                            </div>
                        )}
                    </div>
                    {/* Remove button */}
                    {typeof disableRemove === "undefined" || !disableRemove ? (
                        <div className="mt-3">
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={onRemove}
                            >
                                Remove
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default FastaGenerateForm;
