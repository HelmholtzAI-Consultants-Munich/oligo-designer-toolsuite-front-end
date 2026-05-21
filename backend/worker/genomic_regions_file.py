import logging
import os
from collections import defaultdict
from typing import Any

import yaml
from Bio import SeqIO
from oligo_designer_toolsuite.utils import FastaParser


class GenomicRegionsFile:
    LIST_FIELDS = ("transcript_id", "exon_number", "start", "end")

    def __init__(
        self, regions_path: str, fasta_paths: list[str], probes_path: str, pipeline_name: str, logger=None
    ):
        self.regions_path = regions_path
        self.fasta_paths = fasta_paths
        self.probes_path = probes_path
        self.pipeline_name = pipeline_name
        self.logger = logger or logging.getLogger(__name__)

        self.genes = self._load_genes()
        self.probes, self.scores = self._load_probes_and_scores()
        self.regions = self._load_regions()

    # write regions to a yaml file
    def yaml_dump(self, yaml_path: str):
        with open(yaml_path, "w") as yaml_file:
            yaml.dump(
                {
                    "regions": self.regions if self.regions else None,
                    "probes": self.probes if self.probes else None,
                    "scores": self.scores if self.scores else None,
                },
                yaml_file,
            )

    def _load_genes(self):
        """Load gene names from regions file."""
        genes = set()
        with open(self.regions_path) as f:
            for line in f:
                genes.add(line.strip())
        return list(genes)

    def _load_probes_and_scores(self):
        """Load probes and scores from probes yaml file, match probes to regions, and fill gaps for exon-exon junction probes."""
        probes: defaultdict[Any, dict] = defaultdict(lambda: defaultdict(list))
        scores: defaultdict[Any, dict] = defaultdict(lambda: defaultdict(list))

        if not os.path.exists(self.probes_path):
            print(f"Warning: Probes file {self.probes_path} not found, skipping probe loading.")
            return probes, scores

        with open(self.probes_path) as f:
            probe_data = yaml.safe_load(f)
            for gene, oligosets in probe_data.items():
                if gene not in self.genes:
                    continue
                for oligoset_name, oligoset_entries in oligosets.items():
                    score = oligoset_entries["Oligoset Score"]
                    scores[gene][oligoset_name] = {
                        "average": score["set_score_average"],
                        "worst": score["set_score_worst"],
                    }
                    # only keep entries whose key begins with "Oligo "
                    oligo_probes = filter(lambda x: x[0].startswith("Oligo "), oligoset_entries.items())
                    for _, probe_info in oligo_probes:
                        # add probe info to probes dict
                        probes_list = self._generate_probes_from_probe_info(probe_info)
                        for probe in probes_list:
                            probes[gene][oligoset_name].append(probe)

        # convert defaultdict to dict for clean output
        for gene in probes:
            probes[gene] = dict(probes[gene])
        for gene in scores:
            scores[gene] = dict(scores[gene])
        return dict(probes), dict(scores)

    def _generate_probes_from_probe_info(self, probe_info):
        """Generate probe entries from probe info, handling multiple locations for the same probe sequence and filling gaps for exon-exon junction probes."""
        # cast entries to lists of lists if they are not already
        for field in probe_info:
            if not isinstance(probe_info[field], list):
                probe_info[field] = [probe_info[field]]
            entries_list = []
            for entry in probe_info[field]:
                if isinstance(entry, list):
                    entries_list.append(entry)
                else:
                    entries_list.append([entry])
            probe_info[field] = entries_list

        # explode all fields of probe_info into separate probe entries (assume all fields have the same length, fall back to first entry if field has different length)
        # in most cases, there will only be one entry
        # in rare cases, the same probe sequence can be located at multiple positions
        # -> then some fields (e.g. start, end) will have multiple entries, while others (e.g. sequence_...) will only have one entry that applies to all locations
        probe_entries = []
        probes_count = len(probe_info["start"])
        for i in range(probes_count):
            probe_entry: dict
            index = i if len(probe_info[field]) == probes_count else 0
            probe_entries.append(
                {
                    field: (lst if field in self.LIST_FIELDS else lst[0])
                    for field in probe_info
                    if (lst := probe_info[field][index])
                }
            )

        probes = []
        for probe_index, probe_entry in enumerate(probe_entries):
            regiontype = probe_entry.get("regiontype", "unknown")
            starts = probe_entry["start"]
            ends = probe_entry["end"]
            transcript_ids = probe_entry.get("transcript_id", [])
            exon_numbers = probe_entry.get("exon_number", [])

            components = []
            if regiontype != "exonexonjunction":
                # single continous probe, add as single component
                components.append({"start": starts[0], "end": ends[0], "type": "probe"})
            else:
                # for exon-exon junction probes, add gaps between exons as components
                components.append({"start": starts[0], "end": ends[0], "type": "probe"})
                components.append({"start": ends[0] + 1, "end": starts[1] - 1, "type": "gap"})
                components.append({"start": starts[1], "end": ends[1], "type": "probe"})

            probes.append(
                {
                    "oligo_id": probe_entry["oligo_id"]
                    + (f"({probe_index + 1})" if probes_count > 1 else ""),
                    "components": components,
                    "transcript_ids": transcript_ids,
                    "exon_numbers": exon_numbers,
                    "regiontype": regiontype,
                    "pipeline": self.pipeline_name,
                    "start": starts[0],
                    "end": ends[-1],
                    "details": probe_entry,
                }
            )
        return probes

    def _load_regions(self):
        """Load and process regions from fasta files.

        Collect regions from fasta files, parse fasta headers to extract region information, and group regions by gene and transcript.
        Then process regions to fill gaps between exons and merge overlapping or contiguous regions of the same type.
        """
        regions = defaultdict(lambda: defaultdict(list))
        fasta_parser = FastaParser()

        for fname in self.fasta_paths:
            if not os.path.exists(fname):
                self.logger.warning(f"Warning: Fasta file {fname} not found, skipping.")
                continue
            seq_record = SeqIO.index(fname, "fasta")
            for idx in seq_record:
                self._populate_regions_with_region(idx, fasta_parser, seq_record, regions)

        # empty copy of regions
        processed_regions = {
            gene: {transcript: [] for transcript in transcripts} for gene, transcripts in regions.items()
        }

        for gene, transcripts in regions.items():
            for transcript_id, transcript_regions in transcripts.items():
                self._merge_regions_for_transcript(processed_regions, gene, transcript_id, transcript_regions)
        return processed_regions

    def _populate_regions_with_region(self, idx, fasta_parser, seq_record, regions):
        """Parse fasta header to extract region information and add region to regions dict grouped by gene and transcript."""
        region_name, additional_info, coordinates = fasta_parser.parse_fasta_header(idx)
        gene = region_name.lstrip(">")
        record = seq_record[idx]
        if gene not in self.genes:
            return

        region_sequence = str(record.seq)  # required in FASTA
        starts = coordinates["start"]  # required, despite ODT docs saying otherwise
        ends = coordinates["end"]  # required, despite ODT docs saying otherwise
        start_ends = list(zip(starts, ends))
        start_ends.sort(key=lambda x: x[0])  # sort by start position
        chromosome = coordinates["chromosome"][  # required, despite ODT docs saying otherwise
            0  # assume one chromosome per region
        ]
        strand = coordinates["strand"][  # required, despite ODT docs saying otherwis
            0  # assume one strand per region
        ]
        if strand == "-":
            # reverse sequence for negative strand
            region_sequence = region_sequence[::-1]

        # optional fields, always lists if present
        transcript_ids = additional_info.get("transcript_id", ["unknown"])
        region_type = additional_info.get("regiontype", ["unknown"])[0]

        for transcript_index, transcript_id in enumerate(transcript_ids):
            transcript_sequence = region_sequence
            if region_type == "exonexonjunction":
                exon_numbers = list(
                    map(int, additional_info.get("exon_number", [""])[transcript_index].split("__JUNC__"))
                )
            else:
                exon_number_list = additional_info.get("exon_number", [])
                exon_numbers = [
                    exon_number_list[transcript_index] if transcript_index < len(exon_number_list) else None
                ]

            if len(exon_numbers) != len(start_ends):
                print(
                    f"Warning: Number of exon numbers does not match number of components on transcript {transcript_id} for record {idx} in gene {gene}, skipping  processing."
                )
                continue

            for i, (start, end) in enumerate(start_ends):
                # assume start < end
                # for exon-exon junctions, multiple start-end pairs are concatenated, so we need to split the sequence accordingly
                sequence, transcript_sequence = (
                    transcript_sequence[: end - start + 1],
                    transcript_sequence[end - start + 1 :],
                )
                regions[gene][transcript_id].append(
                    {
                        "regiontype": region_type,
                        "exon_number": exon_numbers[i],
                        "sequence": sequence,
                        "start": start,
                        "end": end,
                        "chromosome": chromosome,
                        "strand": strand,
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
                            "chromosome": chromosome,
                            "strand": strand,
                        }
                    )

    def _merge_regions_for_transcript(self, processed_regions, gene, transcript_id, regions):
        """Merge overlapping or contiguous regions of the same type and fill gaps between exons for a given transcript."""
        # regions can not be empty, otherwise the transcript would not exist
        strand = regions[0]["strand"]
        # sort regions by start position (reverse by end position for negative strand)
        regions.sort(key=lambda x: x["start"] if strand == "+" else x["end"], reverse=(strand == "-"))
        merged_regions = []
        last_region = None

        for region in regions:
            if last_region is None:
                last_region = region
                continue
            overlap_length = (
                last_region["end"] - region["start"] + 1
                if strand == "+"
                else region["end"] - last_region["start"] + 1
            )

            # overlapping or contiguous regions of mergeable type, merge them
            if overlap_length >= 0 and self._mergable_regions(last_region, region):
                if strand == "+":
                    last_region["end"] = max(last_region["end"], region["end"])
                else:
                    last_region["start"] = min(last_region["start"], region["start"])
                # concatenate sequence without overlap
                if last_region["sequence"] is not None and region["sequence"] is not None:
                    if strand == "+":
                        last_region["sequence"] += region["sequence"][overlap_length:]
                    else:
                        last_region["sequence"] = (
                            region["sequence"][:-overlap_length] + last_region["sequence"]
                        )
                # handle exon-exon junctions
                if last_region["regiontype"] == "exonexonjunction":
                    last_region["regiontype"] = "exon"

            # non-overlapping region, add last_region to merged list
            elif overlap_length < 0:
                merged_regions.append(last_region)
                gap_start = last_region["end"] + 1 if strand == "+" else region["end"] + 1
                gap_end = region["start"] - 1 if strand == "+" else last_region["start"] - 1

                # fill gap (exon between same exon_number, intron between exons, exon between introns)
                regiontype = "unknown"
                exon_number = None

                if (
                    last_region["exon_number"] is not None
                    and region["exon_number"] is not None
                    and last_region["exon_number"] == region["exon_number"]
                ):
                    last_region["regiontype"] = "exon"
                    region["regiontype"] = "exon"
                    regiontype = "exon"
                    exon_number = last_region["exon_number"]
                else:
                    match (last_region["regiontype"], region["regiontype"]):
                        case ("exon", "exon"):
                            regiontype = "intron"
                        case ("intron", "intron"):
                            regiontype = "exon"

                region_dict = {
                    "regiontype": regiontype,
                    "exon_number": exon_number,
                    "sequence": None,
                    "start": gap_start,
                    "end": gap_end,
                    "chromosome": last_region["chromosome"],
                    "strand": last_region["strand"],
                    "inferred": True,
                }
                merged_regions.append(region_dict)
                last_region = region

            # overlapping or contiguous regions of different types, keep both
            else:
                merged_regions.append(last_region)
                last_region = region

        if last_region is not None:
            merged_regions.append(last_region)
        processed_regions[gene][transcript_id] = merged_regions

    def _mergable_regions(self, region1, region2):
        """Determine if two regions are mergable based on their exon number and region type."""
        if region1["exon_number"] != region2["exon_number"]:
            return False

        type1 = region1["regiontype"]
        type2 = region2["regiontype"]
        if type1 == type2:
            return True

        mergable_types = [
            ("exon", "exonexonjunction"),
            ("exonexonjunction", "exon"),
        ]
        return (type1, type2) in mergable_types
