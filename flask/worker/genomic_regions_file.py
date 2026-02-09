from collections import defaultdict
import os
import string
from Bio import SeqIO
from oligo_designer_toolsuite.utils import FastaParser
import yaml
from collections.abc import Mapping

class GenomicRegionsFile:
    BASE_DETAILS_FIELDS = ["oligo_id", "start", "end", "chromosome", "source", "species", "annotation_release", "genome_assembly", "strand", "length", "sequence_target", "sequence_target_probe"]

    PROBE_DETAILS_FIELDS: Mapping[str, list[str]] = {
        "scrinshot": BASE_DETAILS_FIELDS + ["sequence_padlock_probe", "sequence_detection_oligo", "sequence_padlock_arm1", "sequence_padlock_accessory1", "sequence_padlock_ISS_anchor", "barcode", "sequence_padlock_accessory2", "sequence_padlock_arm2", "ligation_site", "Tm_arm1", "Tm_arm2", "Tm_diff_arms", "Tm_detection_oligo", "isoform_consensus"],
        "seqfish": BASE_DETAILS_FIELDS + ["sequence_seqfish_plus_probe", "sequence_encoding_probe", "sequence_readout_probe_1", "sequence_readout_probe_2", "sequence_readout_probe_3", "sequence_readout_probe_4", "sequence_forward_primer", "sequence_reverse_primer", "GC_content"],
        "merfish": BASE_DETAILS_FIELDS + ["sequence_merfish_probe", "sequence_encoding_probe", "sequence_readout_probe_1", "sequence_readout_probe_2", "sequence_forward_primer", "sequence_reverse_primer", "GC_content"],
        "oligoseq": BASE_DETAILS_FIELDS + ["oligo", "target", "GC_content", "TmNN", "num_targeted_transcripts", "number_total_transcripts", "isoform_consensus", "length_selfcomplement"],
    }

    def __init__(self, regions_path: str, fasta_paths: list[str], probes_path: str, pipeline_name: str):
        self.regions_path = regions_path
        self.fasta_paths = fasta_paths
        self.probes_path = probes_path
        self.pipeline_name = pipeline_name

        self.genes = self._load_genes()
        self.regions = self._collect_regions()
        self.probes = self._load_probes()
        self.regions = self._process_regions()

    # write regions to a yaml file
    def yaml_dump(self, yaml_path: str):
        with open(yaml_path, "w") as yaml_file:
            yaml.dump({
                "regions": self.regions,
                "probes": self.probes,
            }, yaml_file)

    def _load_genes(self):
        genes = set()
        with open(self.regions_path) as f:
            for line in f:
                genes.add(line.strip())
        return list(genes)

    # Collect regions from fasta files
    def _collect_regions(self):
        regions = {gene: defaultdict(list) for gene in self.genes}
        fasta_parser = FastaParser()

        for fname in self.fasta_paths:
            if not os.path.exists(fname):
                print(f"Fasta file {fname} not found, skipping.")
                continue

            seq_record = SeqIO.index(fname, "fasta")
            for idx in seq_record:
                region_name, additional_info, coordinates = fasta_parser.parse_fasta_header(idx)
                gene = region_name.lstrip(">")
                record = seq_record[idx]
                if gene not in self.genes:
                    continue

                transcript_ids = additional_info.get("transcript_id", ["transcript_unknown"])
                for transcript_index, transcript_id in enumerate(transcript_ids):
                    region_type = (
                        additional_info["regiontype"][0] if "regiontype" in additional_info else "unknown"
                    )
                    total_sequence = str(record.seq)
                    exon_number = (
                        additional_info["exon_number"][transcript_index]
                        if "exon_number" in additional_info
                        else None
                    )
                    starts = coordinates["start"]
                    ends = coordinates["end"]
                    strand = coordinates["strand"][0] if "strand" in coordinates else "+"
                    if strand == "-":
                        # reverse sequence for negative strand
                        total_sequence = total_sequence[::-1]
                    start_ends = list(zip(starts, ends))
                    start_ends.sort(key=lambda x: x[0])  # sort by start position
                    for i, (start, end) in enumerate(start_ends):
                        # assume start < end
                        sequence, total_sequence = (
                            total_sequence[: end - start + 1],
                            total_sequence[end - start + 1 :],
                        )
                        regions[gene][transcript_id].append(
                            {
                                "regiontype": region_type,
                                "exon_number": exon_number,
                                "sequence": sequence,
                                "start": start,
                                "end": end,
                                "chromosome": coordinates["chromosome"][i],
                                "strand": strand,
                                "junction_number": exon_number if region_type == "exonexonjunction" else None,
                            }
                        )

                    if region_type == "exonexonjunction":
                        # add introns between exons
                        for j in range(len(start_ends) - 1):
                            intron_start = start_ends[j][1] + 1
                            intron_end = start_ends[j + 1][0] - 1
                            regions[gene][transcript_id].append(
                                {
                                    "regiontype": "intron",
                                    "exon_number": None,
                                    "sequence": None,
                                    "start": intron_start,
                                    "end": intron_end,
                                    "chromosome": coordinates["chromosome"][0],
                                    "strand": coordinates["strand"][0],
                                }
                            )
        return regions

    # Process regions to fill gaps and merge overlapping regions
    def _process_regions(self):
        raw_regions = self.regions
        # empty copy of raw_regions
        processed_regions = {
            gene: {transcript: [] for transcript in transcripts} for gene, transcripts in raw_regions.items()
        }

        for gene, transcripts in raw_regions.items():
            for transcript_id, regions in transcripts.items():
                # regions can not be empty, otherwise the transcript would not exist
                strand = regions[0]["strand"]
                # sort regions by start position (reverse for negative strand)
                regions.sort(key=lambda x: x["start"] if strand == "+" else x["end"], reverse=(strand == "-"))
                merged_regions = []
                last_region = None
                read_counter = 0

                for region in regions:
                    if last_region is None:
                        last_region = region
                        last_region["reading_grid_offset"] = 0
                        continue
                    overlap_length = (
                        last_region["end"] - region["start"] + 1
                        if strand == "+"
                        else region["end"] - last_region["start"] + 1
                    )

                    # overlapping or contiguous regions of same type, merge them
                    if overlap_length >= 0 and last_region["regiontype"] == region["regiontype"]:
                        if strand == "+":
                            last_region["end"] = region["end"]
                        else:
                            last_region["start"] = region["start"]
                        # concatenate sequence without overlap
                        if last_region["sequence"] is not None and region["sequence"] is not None:
                            if strand == "+":
                                last_region["sequence"] += region["sequence"][overlap_length:]
                            else:
                                last_region["sequence"] = (
                                    region["sequence"][:-overlap_length] + last_region["sequence"]
                                )
                        # handle exon-exon junctions
                        if (
                            last_region["regiontype"] == "exonexonjunction"
                            and region["regiontype"] == "exonexonjunction"
                        ):
                            last_region["regiontype"] = "exon"
                            last_exons = last_region.get("exon_number", "").split("__JUNC__")
                            region_exons = region.get("exon_number", "").split("__JUNC__")
                            common_exon = next(filter(lambda x: x in region_exons, last_exons), None)
                            last_region["exon_number"] = common_exon

                    # non-overlapping region, add last_region to merged list
                    elif overlap_length < 0:
                        merged_regions.append(last_region)
                        if last_region["regiontype"] != "intron":
                            read_counter += last_region["end"] - last_region["start"] + 1
                        gap_start = last_region["end"] + 1 if strand == "+" else region["end"] + 1
                        gap_end = region["start"] - 1 if strand == "+" else last_region["start"] - 1

                        # fill gap (intron between exons, exon between introns, exon between exon-exon-junctions)
                        regiontype = "unknown"
                        exon_number = None
                        match (last_region["regiontype"], region["regiontype"]):
                            case ("exon", "exon"):
                                regiontype = "intron"
                            case ("intron", "intron"):
                                regiontype = "exon"
                            case ("exonexonjunction", "exonexonjunction"):
                                last_exons = last_region.get("exon_number", "").split("__JUNC__")
                                region_exons = region.get("exon_number", "").split("__JUNC__")
                                common_exon = next(filter(lambda x: x in region_exons, last_exons), None)
                                last_region["exon_number"] = common_exon
                                region["exon_number"] = common_exon
                                exon_number = common_exon

                                last_region["regiontype"] = "exon"
                                region["regiontype"] = "exon"
                                regiontype = "exon"

                        merged_regions.append(
                            {
                                "regiontype": regiontype,
                                "exon_number": exon_number,
                                "sequence": None,
                                "reading_grid_offset": None if regiontype == "intron" else read_counter % 3,
                                "start": gap_start,
                                "end": gap_end,
                                "chromosome": last_region["chromosome"],
                                "strand": last_region["strand"],
                                "inferred": True,
                            }
                        )
                        if regiontype != "intron":
                            read_counter += gap_end - gap_start + 1
                        last_region = region
                        last_region["reading_grid_offset"] = read_counter % 3

                    # overlapping or contiguous regions of different types, keep both
                    else:
                        merged_regions.append(last_region)
                        if last_region["regiontype"] != "intron":
                            read_counter += last_region["end"] - last_region["start"] + 1
                        last_region = region
                        last_region["reading_grid_offset"] = read_counter % 3

                if last_region is not None:
                    merged_regions.append(last_region)

                processed_regions[gene][transcript_id] = merged_regions
        return processed_regions
    
    def _load_probes(self):
        probes = {gene: defaultdict(list) for gene in self.genes}

        if not os.path.exists(self.probes_path):
            print(f"Probes file {self.probes_path} not found, skipping probe loading.")
            return probes
        
        with open(self.probes_path) as f:
            probe_data = yaml.safe_load(f)
            for gene, oligosets in probe_data.items():
                if gene not in self.genes:
                    continue
                for oligoset_name, oligoset_entries in oligosets.items():
                    # only keep entries whose key begins with "Oligo "
                    oligos = filter(lambda x: x[0].startswith("Oligo "), oligoset_entries.items())
                    for _, oligo_info in oligos:
                        regiontype = oligo_info.get("regiontype", [])[0][0] if "regiontype" in oligo_info else "unknown"
                        start = oligo_info.get("start", [])[0][0]
                        end = oligo_info.get("end", [])[0][0]
                        transcript_ids = oligo_info.get("transcript_id", [])[0]
                        exon_numbers = oligo_info.get("exon_number", [])[0]

                        components = []

                        if regiontype != "exonexonjunction":
                            print(f"Processing probe {oligo_info.get('oligo_id', '')} in gene {gene} as single continuous probe...")
                            print(f"{regiontype}")
                            # single continous probe, add as single component
                            components.append({
                                "start": start,
                                "end": end,
                                "type": "probe"
                            })
                        else:
                            # for exon-exon junction probes, add gaps between exons as components
                            print(f"Processing exon-exon junction probe {oligo_info.get('oligo_id', '')} in gene {gene}...")
                            canonical_transcript_id = transcript_ids[0]
                            canonical_exon_number = exon_numbers[0]
                            canonical_regions = sorted([x for x in self.regions[gene][canonical_transcript_id] if x.get("junction_number", None) == canonical_exon_number], key=lambda x: x["start"])
                            if canonical_regions is None:
                                print(f"Warning: Could not find canonical region for probe {oligo_info.get('oligo_id', '')} in gene {gene}, skipping.")
                                continue

                            print(f"Found canonical regions for probe {oligo_info.get('oligo_id', '')} in gene {gene}: {canonical_regions}")

                            last_end = None
                            for region in canonical_regions:
                                if last_end is not None and region["start"] > last_end + 1:
                                    # add gap component between exons
                                    components.append({
                                        "start": last_end + 1,
                                        "end": region["start"] - 1,
                                        "type": "gap"
                                    })
                                # add exon component
                                components.append({
                                    "start": max(region["start"], start),
                                    "end": min(region["end"], end),
                                    "type": "probe"
                                })
                                last_end = region["end"]
                            
                        # add probe info to probes dict
                        probes[gene][oligoset_name].append({
                            "oligo_id": oligo_info.get("oligo_id", ""),
                            "components": components,
                            "transcript_ids": transcript_ids,
                            "exon_numbers": exon_numbers,
                            "regiontype": regiontype,
                            "details": {
                                **{field: self._recursive_first(oligo_info.get(field, None)) for field in self.PROBE_DETAILS_FIELDS[self.pipeline_name]},
                                "type": self.pipeline_name,
                            },
                        })

        # convert defaultdict to dict for cleaner output
        for gene in probes:
            probes[gene] = dict(probes[gene])
        return probes
    
    def _recursive_first(self, d):
        if isinstance(d, list):
            return self._recursive_first(d[0]) if len(d) > 0 else None
        else:
            return d
                