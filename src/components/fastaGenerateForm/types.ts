import form_Data_Ens from "../forms/schemas/genomicEnsForm";
import form_Data_Ncbi from "../forms/schemas/genomicNcbiForm";

export interface DropDown {
    ncbi: Map<string, string[]>;
    ensembl: Map<string, string[]>;
}

export interface CommentEntry {
    value: string;
    comment: string;
}

export type MaybeCommentEntry<WithComment> = WithComment extends true
    ? CommentEntry
    : string;

interface EnsSourceParams<WithComments> {
    species: MaybeCommentEntry<WithComments>;
    annotation_release: MaybeCommentEntry<WithComments>;
}

interface NcbiSourceParams<WithComments> extends EnsSourceParams<WithComments> {
    taxon: MaybeCommentEntry<WithComments>;
}

export interface BaseFastaFormDataGeneric<WithComments> {
    dir_output: MaybeCommentEntry<WithComments>;
    source: MaybeCommentEntry<WithComments>;
    genomic_regions: {
        gene: MaybeCommentEntry<WithComments>;
        intergenic: MaybeCommentEntry<WithComments>;
        exon: MaybeCommentEntry<WithComments>;
        exon_exon_junction: MaybeCommentEntry<WithComments>;
        utr: MaybeCommentEntry<WithComments>;
        cds: MaybeCommentEntry<WithComments>;
        intron: MaybeCommentEntry<WithComments>;
    };
    exon_exon_junction_block_size: MaybeCommentEntry<WithComments>;
}

export interface EnsFastaFormDataGeneric<
    WithComments,
> extends BaseFastaFormDataGeneric<WithComments> {
    source_params: EnsSourceParams<WithComments>;
}

export interface NcbiFastaFormDataGeneric<
    WithComments,
> extends BaseFastaFormDataGeneric<WithComments> {
    source_params: NcbiSourceParams<WithComments>;
}

export type UploadFastaFormData<FastaFormDataType> = FastaFormDataType & {
    source: string;
};

export type NestedObject = {
    [key: string]: string | NestedObject;
};

export interface GenomicRegionState<Type> {
    files_fasta_target_probe_database: Type[];
    files_fasta_reference_database_target_probe: Type[];
    files_fasta_reference_database_readout_probe: Type[];
    files_fasta_reference_database_primer: Type[];
}

export type FileState = GenomicRegionState<File>;
export type FastaFormState = GenomicRegionState<FastaForm>;
export type FastaFormStateUncommented =
    GenomicRegionState<FastaFormUncommented>;

export interface FastaForm {
    selectedSource: string;
    formDataNcbi: NcbiFastaFormDataGeneric<true>;
    formDataEns: EnsFastaFormDataGeneric<true>;
}

export interface FastaFormUncommented {
    selectedSource: string;
    formDataNcbi: NcbiFastaFormDataGeneric<false>;
    formDataEns: EnsFastaFormDataGeneric<false>;
}

export const defaultFastaForm: FastaForm = {
    selectedSource: "ncbi",
    formDataNcbi: JSON.parse(JSON.stringify(form_Data_Ncbi)),
    formDataEns: JSON.parse(JSON.stringify(form_Data_Ens)),
};
