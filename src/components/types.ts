import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import merfish_form from "../forms/merfish_form";
import scrinshot_form from "../forms/scrinshot_form";
import oligoseq_form from "../forms/oligoseq_form";
import seqfish_form from "../forms/seqfish_form";

export interface FileState {
    file_regions_file: File | null;
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

export type formData = any;
// typeof merfish_form | typeof seqfish_form | typeof oligoseq_form | typeof scrinshot_form;
export type formDataKey = string;
// "files_fasta_reference_database_target_probe"
// | "files_fasta_target_probe_database"
// | "file_regions"
// | "files_fasta_reference_database_primer"
// | "files_fasta_reference_database_readout_probe"

//export type formDataKey = keyof typeof merfish_form | keyof typeof seqfish_form | keyof typeof oligoseq_form | keyof typeof scrinshot_form;
