import logging
import os
from collections import defaultdict

import yaml
from Bio import SeqIO
from oligo_designer_toolsuite.utils import FastaParser


class GenomicRegionsFile:
    LIST_FIELDS = ("trancript_id", "exon_number")

    def __init__(
        self, regions_path: str, fasta_paths: list[str], probes_path: str, pipeline_name: str, logger=None
    ):
        self.regions_path = regions_path
        self.fasta_paths = fasta_paths
        self.probes_path = probes_path
        self.pipeline_name = pipeline_name
        self.logger = logger or logging.getLogger(__name__)

        self.genes = self._load_genes()
        self.regions = self._collect_regions()
        self.probes = self._load_probes()
        self.regions = self._process_regions()

    # write regions to a yaml file
    def yaml_dump(self, yaml_path: str):
        with open(yaml_path, "w") as yaml_file:
            yaml.dump(
                {
                    "regions": self.regions if self.regions else None,
                    "probes": self.probes if self.probes else None,
                },
                yaml_file,
            )

    def _load_genes(self):
        genes = set()
        with open(self.regions_path) as f:
            for line in f:
                genes.add(line.strip())
        return list(genes)

    # Collect regions from fasta files
    def _collect_regions(self):
        regions = defaultdict(lambda: defaultdict(list))
        fasta_parser = FastaParser()

        for fname in self.fasta_paths:
            if not os.path.exists(fname):
                self.logger.warning(f"Warning: Fasta file {fname} not found, skipping.")
                continue

            seq_record = SeqIO.index(fname, "fasta")
            for idx in seq_record:
                region_name, additional_info, coordinates = fasta_parser.parse_fasta_header(idx)
                gene = region_name.lstrip(">")
                record = seq_record[idx]
                if gene not in self.genes:
                    continue

                region_type = (
                    additional_info["regiontype"][0] if "regiontype" in additional_info else "unknown"
                )
                region_sequence = str(record.seq)

                starts = coordinates["start"]
                ends = coordinates["end"]
                start_ends = list(zip(starts, ends))
                start_ends.sort(key=lambda x: x[0])  # sort by start position

                strand = coordinates["strand"][0] if "strand" in coordinates else "+"
                if strand == "-":
                    # reverse sequence for negative strand
                    region_sequence = region_sequence[::-1]
                transcript_ids = additional_info.get("transcript_id", ["unknown"])

                for transcript_index, transcript_id in enumerate(transcript_ids):
                    transcript_sequence = region_sequence
                    if region_type == "exonexonjunction":
                        exon_numbers = additional_info.get("exon_number", [""])[transcript_index].split(
                            "__JUNC__"
                        )
                    else:
                        exon_number_list = additional_info.get("exon_number", [])
                        exon_numbers = [
                            exon_number_list[transcript_index]
                            if transcript_index < len(exon_number_list)
                            else None
                        ]

                    if len(exon_numbers) != len(start_ends):
                        print(
                            f"Warning: Number of exon numbers does not match number of components for record {idx} in gene {gene}, skipping  processing."
                        )
                        continue

                    for i, (start, end) in enumerate(start_ends):
                        # assume start < end
                        # usually we expect just one start and end per record
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
                                "chromosome": coordinates["chromosome"][i],
                                "strand": strand,
                                "junction_number": additional_info.get("exon_number", [None])[
                                    transcript_index
                                ]
                                if region_type == "exonexonjunction"
                                else None,
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

    # Load probes from probes yaml file and match them to regions, filling gaps for exon-exon junction probes
    def _load_probes(self):
        probes = defaultdict(lambda: defaultdict(list))

        if not os.path.exists(self.probes_path):
            print(f"Warning: Probes file {self.probes_path} not found, skipping probe loading.")
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
                        regiontype = oligo_info.get("regiontype", [["unknown"]])[0][0]
                        start = oligo_info["start"][0][0]
                        end = oligo_info["end"][0][0]
                        transcript_ids = oligo_info.get("transcript_id", [[]])[0]
                        exon_numbers = oligo_info.get("exon_number", [[]])[0]

                        components = []

                        if regiontype != "exonexonjunction":
                            # single continous probe, add as single component
                            components.append({"start": start, "end": end, "type": "probe"})
                        else:
                            # for exon-exon junction probes, add gaps between exons as components
                            # use canonical transcript and exon number to determine exon boundaries for gaps
                            # they have to be available in exon-exon junction probes
                            canonical_transcript_id = transcript_ids[0]
                            canonical_exon_number = exon_numbers[0]
                            canonical_regions = sorted(
                                [
                                    x
                                    for x in self.regions[gene][canonical_transcript_id]
                                    if x.get("junction_number", None) == canonical_exon_number
                                ],
                                key=lambda x: x["start"],
                            )
                            if not canonical_regions:
                                print(
                                    f"Warning: Could not find canonical region for probe {oligo_info.get('oligo_id', '')} in gene {gene}, skipping."
                                )
                                continue

                            last_end = None
                            for region in canonical_regions:
                                if last_end is not None and region["start"] > last_end + 1:
                                    # add gap component between exons
                                    components.append(
                                        {"start": last_end + 1, "end": region["start"] - 1, "type": "gap"}
                                    )
                                # add exon component
                                components.append(
                                    {
                                        "start": max(region["start"], start),
                                        "end": min(region["end"], end),
                                        "type": "probe",
                                    }
                                )
                                last_end = region["end"]

                        # add probe info to probes dict
                        probes[gene][oligoset_name].append(
                            {
                                "oligo_id": oligo_info.get("oligo_id", ""),
                                "components": components,
                                "transcript_ids": transcript_ids,
                                "exon_numbers": exon_numbers,
                                "regiontype": regiontype,
                                "pipeline": self.pipeline_name,
                                "details": {
                                    **{
                                        field: self._recursive_first(oligo_info.get(field, None))
                                        for field in oligo_info
                                        if field not in self.LIST_FIELDS
                                    },
                                    **{
                                        field: oligo_info.get(field, [[]])[0]
                                        for field in self.LIST_FIELDS
                                        if field in oligo_info
                                    },
                                },
                            }
                        )

        # convert defaultdict to dict for cleaner output
        for gene in probes:
            probes[gene] = dict(probes[gene])
        return dict(probes)

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

        return processed_regions

    def _mergable_regions(self, region1, region2):
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

    def _recursive_first(self, d):
        if isinstance(d, list):
            return self._recursive_first(d[0]) if len(d) > 0 else None
        else:
            return d
