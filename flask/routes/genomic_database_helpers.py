import datetime
import ftplib

from extensions import mongo


class BaseGenomicDataBase:
    def __init__(self, host: str = "", base_path: str = "", whitelist: list[str] | None = None) -> None:
        self.host: str = host
        self.base_path: str = base_path
        self.whitelist: list[str] | None = whitelist
        self.name: str = ""
        pass

    def get_dirs(self, ftp: ftplib.FTP) -> list[str]:
        lines: list[str] = []
        _ = ftp.retrlines("LIST", lines.append)

        entries: list[str] = []
        for line in lines:
            parts = line.split(maxsplit=8)
            if len(parts) < 9:
                continue
            if parts[0][0] == "d" or parts[0][0] == "l":
                entries.append(parts[8])
        return entries

    def _filter_whitelist(self, dirs: list[str]):
        if self.whitelist is not None:
            return [dir for dir in dirs if dir in self.whitelist]
        return dirs

    def _get_species_dirs(self, dirs, ftp):
        dirs.sort()

        all_species_dirs = []
        for dir in dirs:
            _ = ftp.cwd(f"/{self.base_path}/{dir}")
            all_species_dirs.extend([self.get_dirs(ftp)])
        return all_species_dirs

    def _build_directory_dict(self, top_dirs, species_dirs):
        return {top_dir: species_dirs for top_dir, species_dirs in zip(top_dirs, species_dirs)}

    def fetch_ftp_directories(self):
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            ftp.cwd(self.base_path)
            top_dirs = self.get_dirs(ftp)
            top_dirs = self._filter_whitelist(top_dirs)
            species_dirs = self._get_species_dirs(top_dirs, ftp)
        return self.name, self._build_directory_dict(top_dirs, species_dirs)


class EnsemblGenomicDataBase(BaseGenomicDataBase):
    def __init__(self, host="ftp.ensembl.org", base_path="/pub/", whitelist=None) -> None:
        super().__init__(host, base_path, whitelist)
        self.name = "ensembl"
        self.orig_top_dirs = [""]

    def _get_species_dirs(self, dirs, ftp):
        self.orig_top_dirs = dirs
        dirs = [f"{dir}/fasta" if dir.startswith("release") else dir for dir in dirs]
        return super()._get_species_dirs(dirs, ftp)

    def _build_directory_dict(self, top_dirs, species_dirs):
        return self.reverse_dict(super()._build_directory_dict(self.orig_top_dirs, species_dirs))

    def reverse_dict(self, directories):
        reversed_directories = {}
        for release, species_dirs in directories.items():
            for species_dir in species_dirs:
                try:
                    reversed_directories[species_dir].append(release)
                except KeyError:
                    reversed_directories[species_dir] = [release]
        return reversed_directories


class NCBIGenomicDataBase(BaseGenomicDataBase):
    def __init__(self, host="ftp.ncbi.nlm.nih.gov", base_path="genomes/refseq/", whitelist=None) -> None:
        super().__init__(host, base_path, whitelist)
        self.name = "ncbi"

    def _try_change_directory(self, ftp: ftplib.FTP, taxon: str, species: str, dir: str):
        try:
            return ftp.cwd(f"{self.base_path}/{taxon}/{species}/{dir}")
        except ftplib.Error:
            return None

    def fetch_annotations_releases(self, taxon: str, species: str):
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            possible_dirs = ["annotation_releases", "all_assembly_versions"]

            for dir in possible_dirs:
                if self._try_change_directory(ftp, taxon, species, dir) is not None:
                    dirs = self.get_dirs(ftp)
                    dirs = [dir.split()[0] for dir in dirs if len(dir.split()) > 1 or dir == "current"]
                    return sorted(dirs)

            return None


def cache_dropdown_options():
    if "cache" not in mongo.db.list_collection_names():
        mongo.db.create_collection("cache")
        mongo.db["cache"].insert_one(
            {"_id": 1, "data": prefetch_dropdown_options(), "timestamp": datetime.datetime.today()}
        )
        return

    cache = mongo.db["cache"]

    doc = cache.find_one({"_id": 1})

    if doc is None:
        cache.insert_one(
            {"_id": 1, "data": prefetch_dropdown_options(), "timestamp": datetime.datetime.today()}
        )
    else:
        if (datetime.datetime.today() - doc["timestamp"]).days >= 1:
            cache.insert_one(
                {"_id": 1},
                {"$set": {"timestamp": datetime.datetime.today(), "data": prefetch_dropdown_options()}},
            )


def prefetch_dropdown_options():
    # TODO: check whitelists to apply same behaviour like before
    return dict(
        [
            NCBIGenomicDataBase(
                whitelist=["vertebrate_mammalian", "archaea", "invertebrate", "plant"],
            ).fetch_ftp_directories(),
            EnsemblGenomicDataBase(
                whitelist=["current_gtf", "current_fasta", *[f"release-{i}" for i in range(110, 116)]],
            ).fetch_ftp_directories(),
        ]
    )
