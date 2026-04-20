import { Trash } from "react-bootstrap-icons";
import {
    defaultFastaForm,
    type FastaForm,
    type FastaFormState,
} from "../fastaGenerateForm/types";
import FastaGenerateForm from "./FastaGenerateForm";
import { useMemo } from "react";
import { Button, InputGroup } from "react-bootstrap";
import {
    firstLetterUppercase,
    regionDisplayNames,
    replaceUnderscore,
} from "../fastaGenerateForm/helpers";
import { showModal } from "../../utils/modalUtil";

type Props = {
    name: keyof FastaFormState;
    id: string;
    setFastaForms: React.Dispatch<React.SetStateAction<FastaFormState>>;
    fastaForms: FastaFormState;
};

const addFastaGenerationForm = (
    e: React.MouseEvent<HTMLButtonElement>,
    setFastaForms: React.Dispatch<React.SetStateAction<FastaFormState>>
) => {
    const name = (e.target as HTMLButtonElement).name as keyof FastaFormState;

    setFastaForms((prevForms) => ({
        ...prevForms,
        [name]: [...prevForms[name], defaultFastaForm], // Multiple files (always an array)
    }));
};

const FastaGeneration: React.FC<Props> = ({
    name,
    id,
    setFastaForms,
    fastaForms,
}) => {
    const onChangeFunctions = useMemo(
        () =>
            fastaForms[name].map((_, idx) => (updatedForm: FastaForm) => {
                setFastaForms((prevForms: FastaFormState) => ({
                    ...prevForms,
                    [name]: prevForms[name].map((f, i) =>
                        i === idx ? updatedForm : f
                    ),
                }));
            }),
        [name, fastaForms, setFastaForms]
    );

    const onRemoveFunctions = useMemo(
        () =>
            fastaForms[name].map((_, idx) => () => {
                setFastaForms((prevForms: FastaFormState) => ({
                    ...prevForms,
                    [name]:
                        prevForms[name].length === 0
                            ? prevForms[name]
                            : prevForms[name].filter((_, i) => i !== idx),
                }));
            }),
        [name, fastaForms, setFastaForms]
    );

    const onEditFunctions = useMemo(
        () =>
            fastaForms[name].map((form, idx) => () => {
                showModal({
                    rawContent: (
                        <FastaGenerateForm
                            id={`${id}-${idx}`}
                            key={`${id} ${idx}`}
                            form={form}
                            onChange={onChangeFunctions[idx]}
                            // onRemove={onRemoveFunctions[idx]}
                            // disableRemove={fastaForms[name].length === 0}
                        />
                    ),
                });
            }),
        [name, fastaForms, id, onChangeFunctions]
    );

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

    return (
        <div className="flex-grow-1 my-1">
            <button
                type="button"
                className="btn btn-outline-primary w-100"
                name={name}
                onClick={(e) => addFastaGenerationForm(e, setFastaForms)}
            >
                Generate FASTA+
            </button>

            <div>
                {fastaForms[name].map((form, idx) => (
                    <InputGroup key={`${id} ${idx}`}>
                        <Button
                            variant="outline-border"
                            className="flex-grow-1"
                            onClick={onEditFunctions[idx]}
                        >
                            {FastaFormPreview(form)}
                        </Button>
                        <Button
                            variant="outline-border"
                            onClick={onRemoveFunctions[idx]}
                        >
                            <Trash />
                        </Button>
                    </InputGroup>
                ))}
            </div>
        </div>
    );
};
export default FastaGeneration;
