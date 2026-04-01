import type { GenericObjectType } from "@rjsf/utils";
import formDataNcbi from "./forms/schemas/genomicNcbiForm";
import formDataEns from "./forms/schemas/genomicEnsForm";

export interface FileState {
    files_fasta_target_probe_database: File[];
    files_fasta_reference_database_target_probe: File[];
    files_fasta_reference_database_readout_probe: File[];
    files_fasta_reference_database_primer: File[];
}
export interface FastaForm {
    selectedSource: string;
    formDataNcbi: typeof formDataNcbi;
    formDataEns: typeof formDataEns;
}

export const defaultFastaForm: FastaForm = {
    selectedSource: "ncbi",
    formDataNcbi: JSON.parse(JSON.stringify(formDataNcbi)),
    formDataEns: JSON.parse(JSON.stringify(formDataEns)),
};

export type RJSFFormData = GenericObjectType;
export type RJSFFormDataKey = string;
export type Status = "idle" | "submitting" | "running";
export type Modal = {
    show: boolean;
    title: string;
    body: string;
};
