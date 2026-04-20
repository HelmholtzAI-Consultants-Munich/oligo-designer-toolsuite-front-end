import type { WidgetProps } from "@rjsf/utils";
import { type FastaFormState, type FileState } from "./types";
import FileSelection from "./FileSelection";
import FastaGeneration from "../forms/FastaGeneration";

const GenomicInput = ({ id, name, registry }: WidgetProps) => {
    const { files, setFiles, fastaForms, setFastaForms } = registry.formContext;

    return (
        <div className="flex">
            {files[name].length === 0 && (
                <FastaGeneration
                    id={id}
                    name={name as keyof FastaFormState}
                    fastaForms={fastaForms}
                    setFastaForms={setFastaForms}
                />
            )}
            {fastaForms[name].length === 0 && (
                <FileSelection
                    id={id}
                    name={name as keyof FileState}
                    files={files}
                    setFiles={setFiles}
                />
            )}
        </div>
    );
};
export default GenomicInput;
