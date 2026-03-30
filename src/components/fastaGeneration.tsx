import { defaultFastaForm } from "./types";
import type { FastaForm, FastaFormState } from "./types";

import FastaGenerateForm from "../modules/FastaGenerateForm";
import { addFastaGenerationForm } from "./helpers";

type Props = {
    name: keyof FastaFormState;
    id: string;
    setFastaForms: React.Dispatch<React.SetStateAction<FastaFormState>>;
    fastaForms: FastaFormState;
};

const FastaGeneration: React.FC<Props> = ({
    name,
    id,
    setFastaForms,
    fastaForms,
}) => {
    console.log(fastaForms[name]);
    return (
        <div className="flex-grow-1">
            <label htmlFor={id} className="form-label">
                {name}
            </label>
            <button
                type="button"
                className="btn btn-outline-primary w-100"
                name={name}
                onClick={(e) => addFastaGenerationForm(e, setFastaForms)}
            >
                Generate FASTA+
            </button>
            {/* TODO handleSubmit einfügen */}
            <div>
                {fastaForms[name].map((form, idx) => (
                    <FastaGenerateForm
                        key={`${id} ${idx}`}
                        form={form}
                        onChange={(updatedForm: FastaForm) => {
                            setFastaForms((prevForms: FastaFormState) => ({
                                ...prevForms,
                                [name]: prevForms[name].map((f, i) =>
                                    i === idx ? updatedForm : f
                                ),
                            }));
                        }}
                        onRemove={() =>
                            setFastaForms((prevForms: FastaFormState) => ({
                                ...prevForms,
                                [name]:
                                    prevForms[name].length === 0
                                        ? prevForms[name]
                                        : prevForms[name].filter(
                                              (_, i) => i !== idx
                                          ),
                            }))
                        }
                        disableRemove={fastaForms[name].length === 0}
                    />
                ))}
            </div>
        </div>
    );
};
export default FastaGeneration;
