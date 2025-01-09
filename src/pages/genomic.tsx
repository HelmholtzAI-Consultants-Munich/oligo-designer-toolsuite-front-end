import React, {useState} from "react";
import Navbar from "../modules/nav";


interface FormData {
    dir_output: string;
    source: string;
    file_annotation: File | null;
    file_sequence: File | null;
    species: string;
    annotation_release: string;
    genome_assembly: string;
    exon_exon_junction_block_size: number;
    genomic_regions: {
        [key: string]: boolean;
    };
}

const Genomic: React.FC = () => {
    const [formData, setFormData] = useState<FormData>({
        dir_output: "",
        source: "custom",
        file_annotation: null,
        file_sequence: null,
        species: "",
        annotation_release: "",
        genome_assembly: "",
        exon_exon_junction_block_size: 50,
        genomic_regions: {
            gene: true,
            intergenic: true,
            exon: true,
            exon_exon_junction: true,
            utr: true,
            cds: true,
            intron: true,
        },
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        // @ts-ignore
        const { name, value, type, checked } = e.target;

        if (type === "checkbox") {
            setFormData((prev) => ({
                ...prev,
                genomic_regions: {
                    ...prev.genomic_regions,
                    [name]: checked,
                },
            }));
        } else if (type === "file") {
            const file = (e.target as HTMLInputElement).files?.[0] || null;
            setFormData((prev) => ({
                ...prev,
                [name]: file,
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = new FormData();
        payload.append("dir_output", formData.dir_output);
        payload.append("source", formData.source);
        if (formData.file_annotation) {
            payload.append("file_annotation", formData.file_annotation);
        }
        if (formData.file_sequence) {
            payload.append("file_sequence", formData.file_sequence);
        }
        payload.append("species", formData.species);
        payload.append("annotation_release", formData.annotation_release);
        payload.append("genome_assembly", formData.genome_assembly);
        payload.append(
            "exon_exon_junction_block_size",
            String(formData.exon_exon_junction_block_size)
        );

        Object.keys(formData.genomic_regions).forEach((region) => {
            payload.append(region, formData.genomic_regions[region] ? "true" : "false");
        });

        try {
            const response = await fetch("/api/genomic", {
                method: "POST",
                body: payload,
            });

            if (response.ok) {
                alert("Configuration uploaded successfully!");
            } else {
                alert("Error uploading configuration.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred while uploading configuration.");
        }
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-5">
                <h2>Genomic Region Generator</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="dir_output" className="form-label">
                            Output Directory
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            id="dir_output"
                            name="dir_output"
                            value={formData.dir_output}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="source" className="form-label">
                            Source
                        </label>
                        <select
                            className="form-select"
                            id="source"
                            name="source"
                            value={formData.source}
                            onChange={handleChange}
                        >
                            <option value="custom">Custom</option>
                            <option value="NCBI">NCBI</option>
                        </select>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="file_annotation" className="form-label">
                            Annotation File (GTF)
                        </label>
                        <input
                            type="file"
                            className="form-control"
                            id="file_annotation"
                            name="file_annotation"
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="file_sequence" className="form-label">
                            Genome Sequence File (FASTA)
                        </label>
                        <input
                            type="file"
                            className="form-control"
                            id="file_sequence"
                            name="file_sequence"
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="species" className="form-label">
                            Species (Optional)
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            id="species"
                            name="species"
                            value={formData.species}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="annotation_release" className="form-label">
                            Annotation Release (Optional)
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            id="annotation_release"
                            name="annotation_release"
                            value={formData.annotation_release}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="genome_assembly" className="form-label">
                            Genome Assembly (Optional)
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            id="genome_assembly"
                            name="genome_assembly"
                            value={formData.genome_assembly}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="exon_exon_junction_block_size" className="form-label">
                            Exon-Exon Junction Block Size
                        </label>
                        <input
                            type="number"
                            className="form-control"
                            id="exon_exon_junction_block_size"
                            name="exon_exon_junction_block_size"
                            value={formData.exon_exon_junction_block_size}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <h4>Genomic Regions</h4>
                    {Object.keys(formData.genomic_regions).map((region) => (
                        <div className="form-check" key={region}>
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id={region}
                                name={region}
                                checked={formData.genomic_regions[region]}
                                onChange={handleChange}
                            />
                            <label className="form-check-label" htmlFor={region}>
                                {region}
                            </label>
                        </div>
                    ))}

                    <button type="submit" className="btn btn-primary mt-3">
                        Submit Configuration
                    </button>
                </form>
            </div>
        </div>

    );
};

export default Genomic;