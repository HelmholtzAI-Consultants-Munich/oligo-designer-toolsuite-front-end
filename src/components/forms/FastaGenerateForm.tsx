/**
 * FastaGenerateForm.tsx
 *
 * This component renders a form to generate FASTA files from NCBI or Ensembl sources.
 * It allows users to select the data source, species, taxon, annotation release, genomic regions, and additional options.
 * The form is controlled via props and notifies parent components of changes.
 */
import React, { memo, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import type {
    EnsFastaFormDataUncommented,
    FastaFormUncommented,
    NcbiFastaFormDataUncommented,
} from "../fastaGenerateForm/types";
import { BACKEND_URL } from "../../config";
import { SourceSelect } from "../fastaGenerateForm/SourceSelector";
import {
    AnnotationSelect,
    SpeciesSelect,
    TaxonSelect,
} from "../fastaGenerateForm/GenomicDropDown";
import {
    firstLetterUppercase,
    getKeyObjectFromFastaFormBaseSchema,
    replaceUnderscore,
} from "../fastaGenerateForm/helpers";
import { GenomicRegionSelect } from "../fastaGenerateForm/GenomicRegionSelect";
import { NcbiAnnotationSelect } from "../fastaGenerateForm/NcbiAnnotationSelect";
import { closeModal } from "../../utils/modalUtil";
import type { RJSFSchema } from "@rjsf/utils";
import type { DropDown, NestedObject } from "../componentTypes";
import type { JSONSchema7 } from "json-schema";

// Props for FastaGenerateForm, containing current form state and handlers for change/removal.
interface FastaGenerateFormProps {
    id: string;
    form: FastaFormUncommented;
    onChange: (newForm: FastaFormUncommented) => void;
    schema: RJSFSchema;
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
    ({ id, form, onChange, schema }) => {
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [dropDown, setDropDown] = useState<DropDown>();
        const [formState, setFormState] = useState(form);

        // TODO: could be made cleaner
        // the definitions section is the same for every schema, so we just use "scrinshot" here
        const descriptionOnlySchema = getKeyObjectFromFastaFormBaseSchema(
            (schema.properties!.fasta_form as JSONSchema7)
                .items as NestedObject,
            "description"
        ) as RJSFSchema;

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
            let formTarget = newFormData as NestedObject;
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
                formTarget[keys[keys.length - 1]] = checked ? "true" : "false";
            } else {
                formTarget[keys[keys.length - 1]] = value;
            }

            if (
                keys[0] === "source_params" &&
                keys[1] !== "annotation_release"
            ) {
                // Reset annotation release if source params change
                formTarget["annotation_release"] = "";
            }

            return { newFormData, keys, value };
        };

        // Handles changes to the source selector
        const handleSourceChange = (newFastaForm: FastaFormUncommented) => {
            setFormState(newFastaForm);
        };

        // Handles changes to NCBI-specific form fields and checkboxes
        const handleNcbiChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const { newFormData, keys, value } =
                processFormChange<NcbiFastaFormDataUncommented>(
                    e,
                    formState.formDataNcbi
                );

            if (keys[0] === "source_params" && keys[1] === "taxon") {
                // Update dependent fields when source params change
                const selectedTaxon = value.toLowerCase();
                const speciesOptions = dropDown!.ncbi.get(selectedTaxon) || [];
                if (
                    !speciesOptions.includes(
                        formState.formDataNcbi.source_params.species
                    )
                ) {
                    newFormData.source_params.species = speciesOptions[0] || "";
                }
            }

            setFormState({
                ...formState,
                formDataNcbi: {
                    ...newFormData,
                },
            });
        };

        // Handles changes to Ensembl-specific form fields and checkboxes
        const handleEnsChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const { newFormData } =
                processFormChange<EnsFastaFormDataUncommented>(
                    e,
                    formState.formDataEns
                );

            setFormState({
                ...formState,
                formDataEns: {
                    ...newFormData,
                },
            });
        };

        const handleSave = () => {
            onChange(formState);
            closeModal();
        };

        const FastaGenerateFormHeader = () => (
            <Modal.Header closeButton>
                <Modal.Title>Configure FASTA Generation</Modal.Title>
            </Modal.Header>
        );

        if (isLoading) {
            return (
                <>
                    <FastaGenerateFormHeader />
                    <Modal.Body>
                        <div className="d-flex justify-content-center p-5">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">
                                    Loading...
                                </span>
                            </Spinner>
                        </div>
                    </Modal.Body>
                </>
            );
        }

        if (error || !dropDown) {
            console.error("Could not fetch dropdown data: ", error);
            return (
                <>
                    <FastaGenerateFormHeader />
                    <Modal.Body>
                        <Alert key="warning" variant="warning">
                            Could not fetch required data. Please try again.
                        </Alert>
                    </Modal.Body>
                </>
            );
        }

        return (
            <>
                <FastaGenerateFormHeader />
                <Modal.Body>
                    {formState.selectedSource === "ncbi" && (
                        <div>
                            <div className="row g-3">
                                <SourceSelect
                                    id={`ncbi-${id}`}
                                    form={formState}
                                    onChange={handleSourceChange}
                                />
                                <TaxonSelect
                                    id={`ncbi-${id}`}
                                    tooltip={
                                        descriptionOnlySchema.formDataNcbi
                                            .source_params.taxon.description
                                    }
                                    value={
                                        formState.formDataNcbi.source_params
                                            .taxon
                                    }
                                    handleChange={handleNcbiChange}
                                >
                                    {Array.from(dropDown!.ncbi.keys()).map(
                                        (k, idx) => (
                                            <option key={idx} value={k}>
                                                {replaceUnderscore(
                                                    firstLetterUppercase(k)
                                                )}
                                            </option>
                                        )
                                    )}
                                </TaxonSelect>
                                {/* Species selector */}
                                <SpeciesSelect
                                    id={`ncbi-${id}`}
                                    tooltip={
                                        descriptionOnlySchema.formDataNcbi
                                            .source_params.species.description
                                    }
                                    value={
                                        formState.formDataNcbi.source_params
                                            .species
                                    }
                                    handleChange={handleNcbiChange}
                                >
                                    {dropDown!.ncbi
                                        ?.get(
                                            formState.formDataNcbi.source_params.taxon.toLowerCase()
                                        )!
                                        .map((entry) => (
                                            <option key={entry} value={entry}>
                                                {replaceUnderscore(entry)}
                                            </option>
                                        ))}
                                </SpeciesSelect>
                                <NcbiAnnotationSelect
                                    id={`ncbi-${id}`}
                                    tooltip={
                                        descriptionOnlySchema.formDataNcbi
                                            .source_params.annotation_release
                                            .description
                                    }
                                    value={
                                        formState.formDataNcbi.source_params
                                            .annotation_release
                                    }
                                    handleChange={handleNcbiChange}
                                    form={formState}
                                />
                            </div>
                            <GenomicRegionSelect
                                id={`ncbi-${id}`}
                                exon_exon_junction_block_size={
                                    formState.formDataNcbi
                                        .exon_exon_junction_block_size
                                }
                                genomic_regions={
                                    formState.formDataNcbi.genomic_regions
                                }
                                handleChange={handleNcbiChange}
                                schema={{
                                    genomic_regions:
                                        descriptionOnlySchema.formDataNcbi
                                            .genomic_regions,
                                    exon_exon_junction_block_size:
                                        descriptionOnlySchema.formDataNcbi
                                            .exon_exon_junction_block_size,
                                }}
                            />
                        </div>
                    )}
                    {formState.selectedSource === "ensembl" && (
                        <div>
                            {/* Source selector */}
                            <div className="row g-3">
                                <SourceSelect
                                    id={`ensembl-${id}`}
                                    form={formState}
                                    onChange={handleSourceChange}
                                />
                                {/* Species selector */}
                                <SpeciesSelect
                                    id={`ensembl-${id}`}
                                    tooltip={
                                        descriptionOnlySchema.formDataEns
                                            .source_params.species.description
                                    }
                                    value={
                                        formState.formDataEns.source_params
                                            .species
                                    }
                                    handleChange={handleEnsChange}
                                >
                                    {Array.from(dropDown!.ensembl.keys()).map(
                                        (k, idx) => (
                                            <option key={idx} value={k}>
                                                {replaceUnderscore(
                                                    firstLetterUppercase(k)
                                                )}
                                            </option>
                                        )
                                    )}
                                </SpeciesSelect>
                                {/* Annotation release selector */}
                                <AnnotationSelect
                                    id={`ensembl-${id}`}
                                    tooltip={
                                        descriptionOnlySchema.formDataEns
                                            .source_params.annotation_release
                                            .description
                                    }
                                    value={
                                        formState.formDataEns.source_params
                                            .annotation_release
                                    }
                                    handleChange={handleEnsChange}
                                >
                                    <option value="">Select a release</option>
                                    {dropDown!.ensembl
                                        .get(
                                            formState.formDataEns.source_params
                                                .species
                                        )!
                                        .map((release, idx) => (
                                            <option key={idx} value={release}>
                                                {release}
                                            </option>
                                        ))}
                                </AnnotationSelect>
                            </div>
                            <GenomicRegionSelect
                                id={`ensembl-${id}`}
                                exon_exon_junction_block_size={
                                    formState.formDataEns
                                        .exon_exon_junction_block_size
                                }
                                genomic_regions={
                                    formState.formDataEns.genomic_regions
                                }
                                handleChange={handleEnsChange}
                                schema={{
                                    genomic_regions:
                                        descriptionOnlySchema.formDataEns
                                            .genomic_regions,
                                    exon_exon_junction_block_size:
                                        descriptionOnlySchema.formDataEns
                                            .exon_exon_junction_block_size,
                                }}
                            />
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-border" onClick={closeModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                        Save
                    </Button>
                </Modal.Footer>
            </>
        );
    }
);

export default FastaGenerateForm;
