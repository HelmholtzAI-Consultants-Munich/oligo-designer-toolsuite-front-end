import form_Data_Ens from "../../forms/genomic_ens_form";
import form_Data_Ncbi from "../../forms/genomic_ncbi_form";

export interface DropDown {
    ncbi: Map<string, string[]>;
    ensembl: Map<string, string[]>;
}

export interface GenomicRegionState<Type> {
    files_fasta_target_probe_database: Type[];
    files_fasta_reference_database_target_probe: Type[];
    files_fasta_reference_database_readout_probe: Type[];
    files_fasta_reference_database_primer: Type[];
}

export type FileState = GenomicRegionState<File>;
export type FastaFormState = GenomicRegionState<FastaForm>;
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
