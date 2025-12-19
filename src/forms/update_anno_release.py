import requests
from bs4 import BeautifulSoup

NCBI_RELEASES_URL = (
    "https://ftp.ncbi.nlm.nih.gov/refseq/H_sapiens/annotation/annotation_releases/"
)



def fetch_ncbi_annotation_releases(url):
    response = requests.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    releases = [
        link.get("href").rstrip("/")
        for link in soup.find_all("a")
        if link.get("href")
        and link.get("href").endswith("/")
        and not link.get("href").startswith("/")
        and link.get("href") != "../"
    ]

    # Filter only those that look like release directories (numbers, dots, etc.)
    releases = [
        r for r in releases if r[0].isdigit() or r.startswith("GCF") or r == "current"
    ]

    return releases


release_list = fetch_ncbi_annotation_releases(NCBI_RELEASES_URL)

# Write to file
with open("src/forms/ncbiAnnotationReleases.ts", "w", encoding="utf-8") as f:
    f.write("export const ncbiAnnotationReleases = [\n")
    for rel in release_list:
        f.write(f'  "{rel}",\n')
    f.write("];\n")

print(f"✅ Wrote {len(release_list)} releases to ncbiAnnotationReleases.ts")
