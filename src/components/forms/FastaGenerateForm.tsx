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
import type {
    DropDown,
    EnsFastaFormDataGeneric,
    FastaForm,
    NcbiFastaFormDataGeneric,
    NestedObject,
} from "../fastaGenerateForm/types";
import { BACKEND_URL } from "../../config";
import { SourceSelect } from "../fastaGenerateForm/SourceSelector";
import {
    AnnotationSelect,
    SpeciesSelect,
    TaxonSelect,
} from "../fastaGenerateForm/GenomicDropDown";
import { replaceUnderscore } from "../fastaGenerateForm/helpers";
import { GenomicRegionSelect } from "../fastaGenerateForm/GenomicRegionSelect";
import { NcbiAnnotationSelect } from "../fastaGenerateForm/NcbiAnnotationSelect";

// Props for FastaGenerateForm, containing current form state and handlers for change/removal.
interface FastaGenerateFormProps {
    id: string;
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

        const processFormChange = <T,>(
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
            formData: T
        ) => {
            const { name, value } = e.target;
            const checked =
                "checked" in e.target
                    ? (e.target as HTMLInputElement).checked
                    : false;

            const keys = name.split(".");
            const newFormData = { ...formData };
            let formTarget = newFormData as unknown as NestedObject;
            // only index n-1 key to keep a reference to the parent object for onChange
            for (const key of keys.slice(0, -1)) {
                formTarget[key as keyof typeof formTarget] = {
                    ...(formTarget[
                        key as keyof typeof formTarget
                    ] as NestedObject),
                };
                formTarget = formTarget[
                    key as keyof typeof formTarget
                ] as NestedObject;
            }

            if (keys[0] === "genomic_regions") {
                formTarget[keys[keys.length - 1]] = {
                    ...(formTarget[keys[keys.length - 1]] as NestedObject),
                    value: checked ? "true" : "false",
                };
            } else {
                formTarget[keys[keys.length - 1]] = {
                    ...(formTarget[keys[keys.length - 1]] as NestedObject),
                    value: value,
                };
            }

            if (
                keys[0] === "source_params" &&
                keys[1] !== "annotation_release"
            ) {
                // Reset annotation release if source params change
                formTarget["annotation_release"] = {
                    ...(formTarget["annotation_release"] as NestedObject),
                    value: "",
                };
            }

            return { newFormData, keys, value };
        };

        // Handles changes to NCBI-specific form fields and checkboxes
        const handleNcbiChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const { newFormData, keys, value } = processFormChange<
                NcbiFastaFormDataGeneric<true>
            >(e, form.formDataNcbi);

            if (keys[0] === "source_params" && keys[1] === "taxon") {
                // Update dependent fields when source params change
                const selectedTaxon = value.toLowerCase();
                const speciesOptions = dropDown!.ncbi.get(selectedTaxon) || [];
                if (
                    !speciesOptions.includes(
                        form.formDataNcbi.source_params.species.value
                    )
                ) {
                    newFormData.source_params.species = {
                        ...newFormData.source_params.species,
                        value: speciesOptions[0] || "",
                    };
                }
            }

            onChange({
                ...form,
                formDataNcbi: {
                    ...newFormData,
                },
            });
        };

        // Handles changes to Ensembl-specific form fields and checkboxes
        const handleEnsChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const { newFormData } = processFormChange<
                EnsFastaFormDataGeneric<true>
            >(e, form.formDataEns);

            onChange({
                ...form,
                formDataEns: {
                    ...newFormData,
                },
            });
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
                                        <NcbiAnnotationSelect
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
                                            form={form}
                                        />
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
                                            handleChange={handleEnsChange}
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
