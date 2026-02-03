import requests
from bs4 import BeautifulSoup

BASE_URL = "https://ftp.ncbi.nlm.nih.gov/genomes/refseq"

GENOME_CATEGORIES = {
    "vertebrate_mammalian": "Vertebrate Mammalian",
    "vertebrate_other": "Vertebrate other",
    "archaea": "Archaea",
    "fungi": "Fungi",
    "invertebrate": "Invertebrate",
    "metagenomes": "Metagenomes",
    "mitochondrion": "Mitochondrion",
    "plant": "Plant",
    "plasmid": "Plasmid",
    "plastid": "Plastid",
    "protozoa": "Protozoa",
    "unknown": "Unknown",
}


def fetch_entries(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        folders = [
            link.get("href").rstrip("/")
            for link in soup.find_all("a")
            if link.get("href")
            and link.get("href").endswith("/")
            and not link.get("href").startswith("/")
            and link.get("href") != "../"
        ]

        if folders:
            return folders

        # fallback: collect meaningful file names
        files = [
            link.get("href")
            for link in soup.find_all("a")
            if link.get("href")
            and link.get("href") != "../"
            and not link.get("href").endswith("/")
        ]

        return files

    except Exception as e:
        print(f"❌ Failed to fetch {url}: {e}")
        return []


ts_content = "// Auto-generated species or file lists\n\n"

for key, label in GENOME_CATEGORIES.items():
    url = f"{BASE_URL}/{key}/"
    entries = fetch_entries(url)
    list_name = key.replace("-", "_")
    ts_content += f"export const {list_name}Entries = [\n"
    ts_content += "\n".join(f'  "{entry}",' for entry in entries)
    ts_content += "\n];\n\n"
    print(f"✅ {key}: {len(entries)} entries")

# Write once
with open("src/forms/refseqSpecies.ts", "w", encoding="utf-8") as f:
    f.write(ts_content)

print("🎉 All data written to refseqSpecies.ts")
