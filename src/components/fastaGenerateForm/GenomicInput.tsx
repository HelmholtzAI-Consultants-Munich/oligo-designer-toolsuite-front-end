import fastaformSchema from "@schemas/fastaForm.schema.json";
import type { JSONSchema7 } from "json-schema";
import type { FieldProps } from "@rjsf/utils";
import { type FastaFormUncommented } from "./types";
import FastaGenerateForm from "../forms/FastaGenerateForm";
import { showModal } from "../../utils/modalUtil";
import {
    firstLetterUppercase,
    getKeyObjectFromSchema,
    regionDisplayNames,
    replaceUnderscore,
} from "./helpers";
import { Button, Form, InputGroup } from "react-bootstrap";
import { Trash } from "react-bootstrap-icons";
import { Grid, Vertical } from "../ui/Alignment";
import { useCallback } from "react";
import type { NestedObject } from "../componentTypes";

const GenomicInput = ({
    fieldPathId: { $id, path },
    name,
    schema,
    formData,
    onChange,
}: FieldProps) => {
    const id = $id;

    const changeHandlerAbstractFactory = useCallback(
        (fieldPath: string[]) => (newValue: unknown) => {
            onChange(newValue, [...path, ...fieldPath]);
        },
        [onChange, path]
    );

    const files: File[] = formData.files;
    const fastaForms: FastaFormUncommented[] = formData.fasta_form;

    type setterCallback<T> = (prevFiles: T[]) => T[];

    const setFiles = (callback: setterCallback<File>) => {
        changeHandlerAbstractFactory(["files"])(callback(files));
    };

    const setFastaForms = (callback: setterCallback<FastaFormUncommented>) => {
        changeHandlerAbstractFactory(["fasta_form"])(callback(fastaForms));
    };

    const handleFastaFormNew = (
        newForm: FastaFormUncommented,
        onChange: (updatedForm: FastaFormUncommented, idx: number) => void
    ) => {
        handleFastaFormEdit(newForm, onChange, fastaForms.length);
    };

    const handleFastaFormChange = (
        updatedForm: FastaFormUncommented,
        idx: number
    ) => {
        setFastaForms(
            (prevForms) =>
                prevForms.length > idx
                    ? prevForms.map((f, i) => (i === idx ? updatedForm : f))
                    : [...prevForms, updatedForm] // Add new form if idx is out of bounds)
        );
    };

    const handleFastaFormRemove = (idx: number) => {
        setFastaForms((prevForms) =>
            prevForms.length === 0
                ? prevForms
                : prevForms.filter((_, i) => i !== idx)
        );
    };

    const handleFastaFormEdit = (
        form: FastaFormUncommented,
        onChange: (updatedForm: FastaFormUncommented, idx: number) => void,
        idx: number
    ) => {
        showModal({
            rawContent: (
                <FastaGenerateForm
                    id={`${id}-${idx}`}
                    key={`${id} ${idx}`}
                    form={form}
                    schema={schema}
                    onChange={(updatedForm) => onChange(updatedForm, idx)}
                />
            ),
            centered: true,
            ignoreBackdropClick: true,
            dialogClassName: "modal-wide",
        });
    };

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setFiles: (callback: setterCallback<File>) => void
    ) => {
        const { files: selectedFiles } = e.target;
        if (!selectedFiles) return;

        setFiles((prevFiles) => [...prevFiles, ...Array.from(selectedFiles)]);
    };

    const handleFileRemove = (fileIndex: number) => {
        setFiles((prevFiles) =>
            prevFiles.filter((_, idx) => idx !== fileIndex)
        );
    };

    const FastaFormPreview = (form: FastaFormUncommented) => {
        const formData =
            form.selectedSource === "ncbi"
                ? form.formDataNcbi
                : form.formDataEns;
        const species = replaceUnderscore(
            firstLetterUppercase(formData.source_params.species)
        );
        const selectedRegions = Object.entries(formData.genomic_regions)
            .filter(([, selected]) => selected === "true")
            .map(
                ([key]) =>
                    regionDisplayNames[key as keyof typeof regionDisplayNames]
            );

        return `${species} (${selectedRegions.join(", ") || "no regions selected"})`;
    };

    const FilePreview = (file: File) => {
        return `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    };

    return (
        <>
            <Vertical gap="md">
                {fastaForms.length === 0 && files.length === 0 && (
                    <div className="text-muted">
                        No FASTA forms or files uploaded.
                    </div>
                )}
                {fastaForms.map((form, idx) => (
                    <InputGroup key={`${id} ${idx}`} className="flex-nowrap">
                        <Button
                            variant="outline-border"
                            className="flex-grow-1"
                            onClick={() =>
                                handleFastaFormEdit(
                                    form,
                                    handleFastaFormChange,
                                    idx
                                )
                            }
                        >
                            {FastaFormPreview(form)}
                        </Button>
                        <Button
                            variant="outline-border"
                            onClick={() => handleFastaFormRemove(idx)}
                            title="Remove FASTA"
                        >
                            <Trash />
                        </Button>
                    </InputGroup>
                ))}
                {files.map((file, idx) => (
                    <InputGroup key={`${id} ${idx}`} className="flex-nowrap">
                        <Button
                            variant="outline-border"
                            className="flex-grow-1"
                        >
                            {FilePreview(file)}
                        </Button>
                        <Button
                            variant="outline-border"
                            onClick={() => handleFileRemove(idx)}
                            title="Remove file"
                        >
                            <Trash />
                        </Button>
                    </InputGroup>
                ))}
                <Grid gap="md" className="w-100">
                    <Button
                        name={name}
                        onClick={() =>
                            handleFastaFormNew(
                                getKeyObjectFromSchema(
                                    (
                                        schema.properties!
                                            .fasta_form as JSONSchema7
                                    ).items as unknown as NestedObject,
                                    fastaformSchema as unknown as NestedObject,
                                    "default",
                                    true
                                ) as unknown as FastaFormUncommented,
                                handleFastaFormChange
                            )
                        }
                    >
                        Generate FASTA+
                    </Button>
                    <Form.Label className="btn btn-outline-border mb-0">
                        Upload File(s)
                        <Form.Control
                            type="file"
                            className="visually-hidden"
                            id={id}
                            name={name}
                            onChange={(e) => {
                                handleFileChange(
                                    e as React.ChangeEvent<HTMLInputElement>,
                                    setFiles
                                );
                            }}
                            multiple
                        />
                    </Form.Label>
                </Grid>
            </Vertical>
        </>
    );
};
export default GenomicInput;
