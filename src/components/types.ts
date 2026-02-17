import type { GenericObjectType } from "@rjsf/utils";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";

export interface FileState {
    [key: string]: File[];
    files_fasta_target_probe_database: File[];
    files_fasta_reference_database_target_probe: File[];
    files_fasta_reference_database_readout_probe: File[];
    files_fasta_reference_database_primer: File[];
}
export interface FastaForm {
    selectedSource: string;
    formDataNcbi: typeof form_Data_Ncbi;
    formDataEns: typeof form_Data_Ens;
}

export const defaultFastaForm: FastaForm = {
    selectedSource: "ncbi",
    formDataNcbi: JSON.parse(JSON.stringify(form_Data_Ncbi)),
    formDataEns: JSON.parse(JSON.stringify(form_Data_Ens)),
};

export type RJSFFormData = GenericObjectType;
export type RJSFFormDataKey = string;
export type Status = "idle" | "submitting" | "running";
export type Modal = {
    show: boolean;
    title: string;
    body: string;
};
