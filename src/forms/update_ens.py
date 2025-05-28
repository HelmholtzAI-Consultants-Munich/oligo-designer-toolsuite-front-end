import requests
from bs4 import BeautifulSoup

ENSEMBL_GTF_URL = "http://ftp.ensembl.org/pub/release-108/gtf/"

def fetch_ensembl_species(url):
    response = requests.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')

    species = [
        link.get('href').rstrip('/')
        for link in soup.find_all('a')
        if link.get('href') and
           link.get('href').endswith('/') and
           not link.get('href').startswith('/') and
           link.get('href') != '../'
    ]

    return species

species_list = fetch_ensembl_species(ENSEMBL_GTF_URL)

# Write to file
with open("src/forms/ensemblSpecies.ts", "w", encoding="utf-8") as f:
    f.write("export const ensemblSpecies = [\n")
    for species in species_list:
        f.write(f'  "{species}",\n')
    f.write("];\n")

print(f"✅ Wrote {len(species_list)} species to ensemblSpecies.ts")