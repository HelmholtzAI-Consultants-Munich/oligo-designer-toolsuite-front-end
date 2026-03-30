import type { WidgetProps } from "@rjsf/utils";
import { defaultFastaForm, type FastaForm, type FastaFormState } from "./types";
import FastaGeneration from "./fastaGeneration";
import FileSelection from "./fileSelection";

const fileorGenerator = ({ id, name, registry }: WidgetProps) => {
    const { files, setFiles, fastaForms, setFastaForms } = registry.formContext;

    return (
        <div>
            <FastaGeneration
                id={id}
                name={name as keyof FastaFormState}
                fastaForms={fastaForms}
                setFastaForms={setFastaForms}
            />
            <FileSelection
                id={id}
                name={name}
                files={files}
                setFiles={setFiles}
            />
        </div>
    );
};
export default fileorGenerator;
