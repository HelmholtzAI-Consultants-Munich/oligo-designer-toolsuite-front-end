import { defaultFastaForm, FastaForm } from "./types";
import FastaGenerateForm from "../modules/FastaGenerateForm";

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
    <p>
      <div className="mb-3 pt-3">
        <label htmlFor={id} className="form-label">
          {name}
        </label>
        <div className="d-flex align-items-center w-100 gap-2">
          <div className="w-50">
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
          </div>
        </div>
      </div>
      {/* SIMON */}
      <form onSubmit={() => {}}>
        {fastaForms.map((form, idx) => (
          <FastaGenerateForm
            key={idx}
            form={form}
            onChange={(updatedForm: FastaForm) =>
              setFastaForms((forms: FastaForm[]) =>
                forms.map((f, i) => (i === idx ? updatedForm : f))
              )
            }
            onRemove={() =>
              setFastaForms((forms: FastaForm[]) =>
                forms.length === 0 ? forms : forms.filter((_, i) => i !== idx)
              )
            }
            disableRemove={fastaForms.length === 0}
          />
        ))}
      </form>
    </p>
  );
};
export default FastaGeneration;
