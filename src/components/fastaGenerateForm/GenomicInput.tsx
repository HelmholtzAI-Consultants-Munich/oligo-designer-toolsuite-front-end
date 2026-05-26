import type { JSONSchema7 } from "json-schema";
import type { FieldProps } from "@rjsf/utils";
import { type FastaFormUncommented, type setterCallback } from "./types";
import FastaGenerateForm from "../forms/FastaGenerateForm";
import { showModal } from "../../utils/modalUtil";
import {
    buildFileFunctions,
    changeHandlerAbstractFactory,
    firstLetterUppercase,
    getKeyObjectFromFastaFormBaseSchema,
    regionDisplayNames,
    replaceUnderscore,
} from "./helpers";
import { Button } from "react-bootstrap";
import { Grid, Vertical } from "../ui/Alignment";
import type { NestedObject } from "../componentTypes";
import { FileUpload } from "./FileInput";
import { InputList } from "./InputList";

const GenomicInput = ({
    fieldPathId: { $id, path },
    name,
    schema,
    formData,
    onChange,
}: FieldProps) => {
    const id = $id;
    console.log(name);

    const fastaForms: FastaFormUncommented[] = formData.fasta_form;

    const { files, setFiles, handleFileRemove, FilePreview } =
        buildFileFunctions(formData, path, onChange);

    const setFastaForms = (callback: setterCallback<FastaFormUncommented>) => {
        changeHandlerAbstractFactory(
            ["fasta_form"],
            path,
            onChange
        )(callback(fastaForms));
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

    return (
        <Vertical gap="md">
            {fastaForms.length === 0 && files.length === 0 && (
                <div className="text-muted">
                    No FASTA forms or files uploaded.
                </div>
            )}
            <InputList
                id={id}
                handleInputRemove={handleFastaFormRemove}
                inputtedList={fastaForms}
                previewCallback={FastaFormPreview}
                handleInputEdit={(form: FastaFormUncommented, idx: number) =>
                    handleFastaFormEdit(form, handleFastaFormChange, idx)
                }
            />
            <InputList
                id={id}
                handleInputRemove={handleFileRemove}
                inputtedList={files}
                previewCallback={FilePreview}
            />
            <Grid gap="md" className="w-100">
                <Button
                    name={name}
                    onClick={() =>
                        handleFastaFormNew(
                            getKeyObjectFromFastaFormBaseSchema(
                                (schema.properties!.fasta_form as JSONSchema7)
                                    .items as NestedObject,
                                "default",
                                true
                            ) as unknown as FastaFormUncommented,
                            handleFastaFormChange
                        )
                    }
                >
                    Generate FASTA+
                </Button>
                <FileUpload id={id} name={name} setFiles={setFiles} />
            </Grid>
        </Vertical>
    );
};
export default GenomicInput;
