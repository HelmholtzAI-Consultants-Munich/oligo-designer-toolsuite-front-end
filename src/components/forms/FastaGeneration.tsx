import { defaultFastaForm } from "../types";
import type { FastaForm } from "../types";

import FastaGenerateForm from "./FastaGenerateForm";

type Props = {
    name: string;
    id: string;
    setFastaForms: React.Dispatch<React.SetStateAction<FastaForm[]>>;
    fastaForms: FastaForm[];
};

const FastaGeneration: React.FC<Props> = ({
    name,
    id,
    setFastaForms,
    fastaForms,
}) => {
    return (
        <div className="flex-grow-1">
            <label htmlFor={id} className="form-label">
                {name}
            </label>
            <button
                type="button"
                className="btn btn-outline-primary w-100"
                onClick={() =>
                    setFastaForms((forms: FastaForm[]) => [
                        ...forms,
                        { ...defaultFastaForm },
                    ])
                }
            >
                Generate FASTA+
            </button>
            {/* TODO handleSubmit einfügen */}
            <form onSubmit={() => {}}>
                {fastaForms.map((form, idx) => (
                    <FastaGenerateForm
                        key={idx}
                        form={form}
                        onChange={(updatedForm: FastaForm) =>
                            setFastaForms((forms: FastaForm[]) =>
                                forms.map((f, i) =>
                                    i === idx ? updatedForm : f
                                )
                            )
                        }
                        onRemove={() =>
                            setFastaForms((forms: FastaForm[]) =>
                                forms.length === 0
                                    ? forms
                                    : forms.filter((_, i) => i !== idx)
                            )
                        }
                        disableRemove={fastaForms.length === 0}
                    />
                ))}
            </form>
        </div>
    );
};
export default FastaGeneration;
