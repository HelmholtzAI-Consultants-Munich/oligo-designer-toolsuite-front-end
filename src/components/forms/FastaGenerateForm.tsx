/**
 * FastaGenerateForm.tsx
 *
 * This component renders a form to generate FASTA files from NCBI or Ensembl sources.
 * It allows users to select the data source, species, taxon, annotation release, genomic regions, and additional options.
 * The form is controlled via props and notifies parent components of changes.
 */
import React, { memo, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Spinner } from "react-bootstrap";
import type { DropDown, FastaForm } from "../fastaGenerateForm/types";
import { BACKEND_URL } from "../../config";
import { SourceSelect } from "../fastaGenerateForm/sourceSelector";
import {
    AnnotationSelect,
    SpeciesSelect,
    TaxonSelect,
} from "../fastaGenerateForm/genomicDropDown";
import { replaceUnderscore } from "../fastaGenerateForm/helpers";
import { NcbiAnnotationReleases } from "../fastaGenerateForm/ncbiAnnotationReleases";
import { GenomicRegionSelect } from "../fastaGenerateForm/genomicRegionSelect";

// Props for FastaGenerateForm, containing current form state and handlers for change/removal.
interface FastaGenerateFormProps {
    id: number;
    form: FastaForm;
    onChange: (newForm: FastaForm) => void;
    onRemove?: () => void;
    disableRemove?: boolean;
}

type GenomicDropdownEntries = { [index: string]: string[] };
interface RawDropDown {
    ncbi: GenomicDropdownEntries;
    ensembl: GenomicDropdownEntries;
}

/**
 * FastaGenerateForm
 *
 * Renders a dynamic form for FASTA file generation, switching between NCBI and Ensembl options.
 * Handles all controlled input changes and notifies parent components of updates.
 */
const FastaGenerateForm: React.FC<FastaGenerateFormProps> = memo(
    ({ id, form, onChange, onRemove, disableRemove }) => {
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [dropDown, setDropDown] = useState<DropDown>();

        const fetchDropDownData = useCallback(async () => {
            try {
                setIsLoading(true);
                setError(null);
                const DROPDOWN_URL = BACKEND_URL + `/api/genomic/dropdown`;
                const response = await axios.get(DROPDOWN_URL, {
                    withCredentials: true,
                });
                setDropDown(parseDropDown(response.data));
            } catch (err: unknown) {
                if (axios.isAxiosError(err)) {
                    setError(
                        err.response?.data?.error ||
                            "Failed to load Dropdown Options"
                    );
                } else {
                    setError("Failed to load Dropdown Options");
                }
            } finally {
                setIsLoading(false);
            }
        }, []);

        useEffect(() => {
            fetchDropDownData();
        }, [fetchDropDownData]);

        const parseDropDown = (data: RawDropDown) => {
            return {
                ncbi: new Map<string, string[]>(Object.entries(data.ncbi)),
                ensembl: new Map<string, string[]>(
                    Object.entries(data.ensembl)
                ),
            } as DropDown;
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
                const key =
                    name as keyof typeof form.formDataNcbi.genomic_regions;
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
                const key =
                    name as keyof typeof form.formDataEns.genomic_regions;
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

        if (isLoading) {
            return (
                <div className="d-flex justify-content-center p-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            );
        }

        if (error || !dropDown) {
            console.error("Could not fetch dropdown data: ", error);
            return (
                <Alert key="warning" variant="warning">
                    Could not fetch required data. Please try again.
                </Alert>
            );
        }

        return (
            <div className="border border-primary rounded p-3 mb-3 bg-white">
                <div className="d-flex align-items-center ">
                    <div className="col-md-8">
                        <div>
                            {form.selectedSource === "ncbi" && (
                                <div>
                                    <div className="row g-3">
                                        <SourceSelect
                                            id={`ncbi-${id}`}
                                            form={form}
                                            onChange={onChange}
                                        />
                                        <TaxonSelect
                                            id={`ncbi-${id}`}
                                            tooltip={
                                                form.formDataNcbi.source_params
                                                    .taxon.comment
                                            }
                                            value={
                                                form.formDataNcbi.source_params
                                                    .taxon.value
                                            }
                                            handleChange={handleNcbiChange}
                                        >
                                            {Array.from(
                                                dropDown!.ncbi.keys()
                                            ).map((k, idx) => (
                                                <option key={idx} value={k}>
                                                    {replaceUnderscore(
                                                        [
                                                            k[0].toLocaleUpperCase(),
                                                            ...k.slice(1),
                                                        ].join("")
                                                    )}
                                                </option>
                                            ))}
                                        </TaxonSelect>
                                        {/* Species selector */}
                                        <SpeciesSelect
                                            id={`ncbi-${id}`}
                                            tooltip={
                                                form.formDataNcbi.source_params
                                                    .species.comment
                                            }
                                            value={
                                                form.formDataNcbi.source_params
                                                    .species.value
                                            }
                                            handleChange={handleNcbiChange}
                                        >
                                            {dropDown!.ncbi
                                                ?.get(
                                                    form.formDataNcbi.source_params.taxon.value.toLowerCase()
                                                )!
                                                .map((entry) => (
                                                    <option
                                                        key={entry}
                                                        value={entry}
                                                    >
                                                        {replaceUnderscore(
                                                            entry
                                                        )}
                                                    </option>
                                                ))}
                                        </SpeciesSelect>
                                        <AnnotationSelect
                                            id={`ncbi-${id}`}
                                            tooltip={
                                                form.formDataNcbi.source_params
                                                    .annotation_release.comment
                                            }
                                            value={
                                                form.formDataNcbi.source_params
                                                    .annotation_release.value
                                            }
                                            handleChange={handleNcbiChange}
                                        >
                                            <option value="">
                                                Select a release
                                            </option>
                                            <NcbiAnnotationReleases
                                                form={form}
                                            />
                                        </AnnotationSelect>
                                    </div>
                                    <GenomicRegionSelect
                                        id={`ncbi-${id}`}
                                        exon_exon_junction_block_size={
                                            form.formDataNcbi
                                                .exon_exon_junction_block_size
                                        }
                                        genomic_regions={
                                            form.formDataNcbi.genomic_regions
                                        }
                                        handleChange={handleNcbiChange}
                                    />
                                </div>
                            )}
                            {form.selectedSource === "ensembl" && (
                                <div>
                                    {/* Source selector */}
                                    <div className="row g-3">
                                        <SourceSelect
                                            id={`ensembl-${id}`}
                                            form={form}
                                            onChange={onChange}
                                        />
                                        {/* Species selector */}
                                        <SpeciesSelect
                                            id={`ensembl-${id}`}
                                            tooltip={
                                                form.formDataEns.source_params
                                                    .species.comment
                                            }
                                            value={
                                                form.formDataEns.source_params
                                                    .species.value
                                            }
                                            handleChange={handleNcbiChange}
                                        >
                                            {Array.from(
                                                dropDown!.ensembl.keys()
                                            ).map((k, idx) => (
                                                <option key={idx} value={k}>
                                                    {replaceUnderscore(
                                                        [
                                                            k[0].toLocaleUpperCase(),
                                                            ...k.slice(1),
                                                        ].join("")
                                                    )}
                                                </option>
                                            ))}
                                        </SpeciesSelect>
                                        {/* Annotation release selector */}
                                        <AnnotationSelect
                                            id={`ensembl-${id}`}
                                            tooltip={
                                                form.formDataEns.source_params
                                                    .annotation_release.comment
                                            }
                                            value={
                                                form.formDataEns.source_params
                                                    .annotation_release.value
                                            }
                                            handleChange={handleEnsChange}
                                        >
                                            <option value="">
                                                Select a release
                                            </option>
                                            {dropDown!.ensembl
                                                .get(
                                                    form.formDataEns
                                                        .source_params.species
                                                        .value
                                                )!
                                                .map((release, idx) => (
                                                    <option
                                                        key={idx}
                                                        value={release}
                                                    >
                                                        {release}
                                                    </option>
                                                ))}
                                        </AnnotationSelect>
                                    </div>
                                    <GenomicRegionSelect
                                        id={`ensembl-${id}`}
                                        exon_exon_junction_block_size={
                                            form.formDataEns
                                                .exon_exon_junction_block_size
                                        }
                                        genomic_regions={
                                            form.formDataEns.genomic_regions
                                        }
                                        handleChange={handleEnsChange}
                                    />
                                </div>
                            )}
                        </div>
                        {/* Remove button */}
                        {typeof disableRemove === "undefined" ||
                        !disableRemove ? (
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
    }
);

export default FastaGenerateForm;
