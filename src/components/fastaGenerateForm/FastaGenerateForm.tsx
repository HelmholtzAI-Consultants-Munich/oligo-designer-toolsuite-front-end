/**
 * FastaGenerateForm.tsx
 *
 * This component renders a form to generate FASTA files from NCBI or Ensembl sources.
 * It allows users to select the data source, species, taxon, annotation release, genomic regions, and additional options.
 * The form is controlled via props and notifies parent components of changes.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getErrorMessage } from "../../utils/errorUtil";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import type {
    EnsemblGenomicForm,
    GenomicForm,
    NcbiAndEnsemblFormData,
    NcbiGenomicForm,
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
    replaceUnderscore,
} from "../fastaGenerateForm/helpers";
import { GenomicRegionSelect } from "../fastaGenerateForm/GenomicRegionSelect";
import { NcbiAnnotationSelect } from "../fastaGenerateForm/NcbiAnnotationSelect";
import { closeModal } from "../../utils/modalUtil";
import type { DropDown, NestedObject } from "../componentTypes";
import { getDefaultFormState, type RJSFSchema } from "@rjsf/utils";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";

// Props for FastaGenerateForm, containing current form state and handlers for change/removal.
interface FastaGenerateFormProps {
    id: string;
    form: GenomicForm | null;
    onChange: (newForm: GenomicForm) => void;
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
 *
 * @param id - unique ID of the component
 * @param form - current state of the Genomic Region Generator Form
 * @param onChange - callback invoked, when the form is changed, to update the form
 * @param schema - RJSF Schema of the Genomic Region Generator Form
 */
const FastaGenerateForm: React.FC<FastaGenerateFormProps> = memo(
    ({ id, form, onChange, schema }) => {
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [dropDown, setDropDown] = useState<DropDown>();

        const genomicDefaults = useMemo(() => {
            const subschemas =
                (schema.items as { anyOf: RJSFSchema[] }).anyOf || [];
            const genomicDefaults = subschemas.map(
                (subschema) =>
                    getDefaultFormState(
                        customizeValidator({
                            AjvClass: Ajv2020,
                        }),
                        subschema
                    ) as { source: string }
            );

            const getDefaultFor = (source: "ncbi" | "ensembl") =>
                genomicDefaults.filter(
                    (genomicDefault) => genomicDefault.source === source
                )[0];

            return {
                ncbi: getDefaultFor("ncbi") as unknown as NcbiGenomicForm,
                ensembl: getDefaultFor(
                    "ensembl"
                ) as unknown as EnsemblGenomicForm,
            };
        }, [schema]);

        const ncbiAndEnsemblFormData: NcbiAndEnsemblFormData = {
            selectedSource: form?.source || "ncbi",
            formDataNcbi:
                form?.source === "ncbi" ? form : genomicDefaults["ncbi"],
            formDataEnsembl:
                form?.source === "ensembl" ? form : genomicDefaults["ensembl"],
        };
        const [formState, setFormState] = useState(ncbiAndEnsemblFormData);

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
                setError(
                    getErrorMessage(err, "Failed to load Dropdown Options")
                );
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
                formTarget[keys[keys.length - 1]] = checked ? true : false;
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
        const handleSourceChange = (newForm: NcbiAndEnsemblFormData) => {
            setFormState(newForm);
        };

        // Handles changes to NCBI-specific form fields and checkboxes
        const handleNcbiChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
        ) => {
            const { newFormData, keys, value } =
                processFormChange<NcbiGenomicForm>(e, formState.formDataNcbi);

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
            const { newFormData } = processFormChange<EnsemblGenomicForm>(
                e,
                formState.formDataEnsembl
            );

            setFormState({
                ...formState,
                formDataEnsembl: {
                    ...newFormData,
                },
            });
        };

        const handleSave = () => {
            onChange(
                formState.selectedSource === "ncbi"
                    ? formState.formDataNcbi
                    : formState.formDataEnsembl
            );
            closeModal();
        };

        const FastaGenerateFormHeader = () => (
            <Modal.Header closeButton>
                <Modal.Title>Configure Genomic Regions</Modal.Title>
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
                                    value={
                                        formState.formDataEnsembl.source_params
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
                                    value={
                                        formState.formDataEnsembl.source_params
                                            .annotation_release
                                    }
                                    handleChange={handleEnsChange}
                                >
                                    <option value="">Select a release</option>
                                    {dropDown!.ensembl
                                        .get(
                                            formState.formDataEnsembl
                                                .source_params.species
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
                                    formState.formDataEnsembl
                                        .exon_exon_junction_block_size
                                }
                                genomic_regions={
                                    formState.formDataEnsembl.genomic_regions
                                }
                                handleChange={handleEnsChange}
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
