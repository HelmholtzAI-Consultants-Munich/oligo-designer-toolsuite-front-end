from collections import defaultdict
import os
from Bio import SeqIO
from oligo_designer_toolsuite.utils import FastaParser
import yaml

class GenomicRegionFile:
    def __init__(self, regions_path: str, fasta_paths: list[str]):
        self.regions_path = regions_path
        self.fasta_paths = fasta_paths

        self.genes = self._load_genes()
        self.regions = self._load_regions()

    # write regions to a yaml file
    def yaml_dump(self, yaml_path: str):
        with open(yaml_path, "w") as yaml_file:
            yaml.dump(self.regions, yaml_file)



    def _load_genes(self):
        genes = set()
        with open(self.regions_path, 'r') as f:
            for line in f:
                genes.add(line.strip())
        return list(genes)
    
    def _load_regions(self):
        raw_regions = self._collect_regions()
        regions = self._process_regions(raw_regions)
        return regions
    
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
                    strand = coordinates['strand'][0] if 'strand' in coordinates else '+'
                    if strand == '-':
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
    def _process_regions(self, raw_regions):
        # empty copy of raw_regions
        processed_regions = {gene: {transcript: [] for transcript in transcripts} for gene, transcripts in raw_regions.items()}

        for gene, transcripts in raw_regions.items():
            for transcript_id, regions in transcripts.items():
                # sort regions by start position (reverse for negative strand)
                strand = regions[0]["strand"]
                read_counter = 0
                regions.sort(key=lambda x: x["start"], reverse=(strand == '-'))
                merged_regions = []
                last_region = None

                for region in regions:
                    if last_region is None:
                        last_region = region
                        last_region["reading_grid_offset"] = 0
                        continue
                    overlap_length = last_region["end"] - region["start"] + 1 if strand == '+' else region["end"] - last_region["start"] + 1

                    # overlapping or contiguous regions of same type, merge them
                    if overlap_length >= 0 and last_region["regiontype"] == region["regiontype"]:
                        if strand == '+':
                            last_region["end"] = region["end"]
                        else:
                            last_region["start"] = region["start"]
                        # concatenate sequence without overlap
                        if last_region["sequence"] is not None and region["sequence"] is not None:
                            if strand == '+':
                                last_region["sequence"] += region["sequence"][overlap_length:]
                            else:
                                last_region["sequence"] = region["sequence"][: -overlap_length] + last_region["sequence"]
                        # handle exon-exon junctions
                        if last_region["regiontype"] == "exonexonjunction" and region["regiontype"] == "exonexonjunction":
                            last_region["regiontype"] = "exon"
                            last_exons = last_region.get("exon_number", "").split("__JUNC__")
                            region_exons = region.get("exon_number", "").split("__JUNC__")
                            common_exon = list(filter(lambda x: x in region_exons, last_exons))[0]
                            last_region["exon_number"] = common_exon

                    # non-overlapping region, add last_region to merged list
                    elif overlap_length < 0:
                        merged_regions.append(last_region)
                        if last_region["regiontype"] != "intron":
                            read_counter += last_region["end"] - last_region["start"] + 1
                        gap_start = last_region["end"] + 1 if strand == '+' else region["end"] + 1
                        gap_end = region["start"] - 1 if strand == '+' else last_region["start"] - 1

                        # fill gap (intron between exons, exon between introns, exon between exon-exon-junctions)
                        regiontype = "unknown"
                        exon_number = None
                        match (last_region["regiontype"], region["regiontype"]):
                            case ("exon", "exon"):
                                regiontype = "intron"
                            case ("intron", "intron"):
                                regiontype = "exon"
                            case ("exonexonjunction", "exonexonjunction"):
                                last_exons = last_region.get("exon_number", []).split("__JUNC__")
                                region_exons = region.get("exon_number", []).split("__JUNC__")
                                common_exon = list(filter(lambda x: x in region_exons, last_exons))[0]
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
                            read_counter += (gap_end - gap_start + 1)
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
