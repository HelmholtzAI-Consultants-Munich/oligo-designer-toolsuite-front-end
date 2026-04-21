import type { WidgetProps } from "@rjsf/utils";
import {
    defaultFastaForm,
    type FastaForm,
    type FastaFormState,
    type FileState,
} from "./types";
import FastaGenerateForm from "../forms/FastaGenerateForm";
import { showModal } from "../../utils/modalUtil";
import {
    firstLetterUppercase,
    regionDisplayNames,
    replaceUnderscore,
} from "./helpers";
import { Button, Form, InputGroup } from "react-bootstrap";
import { Trash } from "react-bootstrap-icons";
import { Grid, Vertical } from "../ui/Alignment";

const GenomicInput = ({ id, name, registry }: WidgetProps) => {
    const formKey = name as keyof FastaFormState;

    const { files, setFiles, fastaForms, setFastaForms } =
        registry.formContext as {
            files: FileState;
            setFiles: React.Dispatch<React.SetStateAction<FileState>>;
            fastaForms: FastaFormState;
            setFastaForms: React.Dispatch<React.SetStateAction<FastaFormState>>;
        };

    const handleFastaFormNew = (
        newForm: FastaForm,
        onChange: (updatedForm: FastaForm, idx: number) => void
    ) => {
        handleFastaFormEdit(newForm, onChange, fastaForms[formKey].length);
    };

    const handleFastaFormChange = (updatedForm: FastaForm, idx: number) => {
        setFastaForms((prevForms: FastaFormState) => ({
            ...prevForms,
            [formKey]:
                prevForms[formKey].length > idx
                    ? prevForms[formKey].map((f, i) =>
                          i === idx ? updatedForm : f
                      )
                    : [...prevForms[formKey], updatedForm], // Add new form if idx is out of bounds
        }));
    };

    const handleFastaFormRemove = (idx: number) => {
        setFastaForms((prevForms: FastaFormState) => ({
            ...prevForms,
            [formKey]:
                prevForms[formKey].length === 0
                    ? prevForms[formKey]
                    : prevForms[formKey].filter((_, i) => i !== idx),
        }));
    };

    const handleFastaFormEdit = (
        form: FastaForm,
        onChange: (updatedForm: FastaForm, idx: number) => void,
        idx: number
    ) => {
        showModal({
            rawContent: (
                <FastaGenerateForm
                    id={`${id}-${idx}`}
                    key={`${id} ${idx}`}
                    form={form}
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
        setFiles: React.Dispatch<React.SetStateAction<FileState>>
    ) => {
        const { name, files: selectedFiles } = e.target;
        if (!selectedFiles) return;

        setFiles((prevFiles) => ({
            ...prevFiles,
            [name]: [
                ...prevFiles[name as keyof FileState],
                ...Array.from(selectedFiles),
            ],
        }));
    };

    const handleFileRemove = (fileIndex: number) => {
        setFiles((prevFiles) => ({
            ...prevFiles,
            [formKey]: prevFiles[formKey].filter((_, idx) => idx !== fileIndex),
        }));
    };

    const FastaFormPreview = (form: FastaForm) => {
        const formData =
            form.selectedSource === "ncbi"
                ? form.formDataNcbi
                : form.formDataEns;
        const species = replaceUnderscore(
            firstLetterUppercase(formData.source_params.species.value)
        );
        const selectedRegions = Object.entries(formData.genomic_regions)
            .filter(([, selected]) => selected.value === "true")
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
                {fastaForms[formKey].length === 0 &&
                    files[formKey].length === 0 && (
                        <div className="text-muted">
                            No FASTA forms or files uploaded.
                        </div>
                    )}
                {fastaForms[formKey].map((form, idx) => (
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
                {files[formKey].map((file, idx) => (
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
                                defaultFastaForm,
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
