import React, {useState} from "react";
import Navbar from "../modules/nav";
import axios from "axios";
const Genomic: React.FC = () => {
    const [selectedSource, setSelectedSource] = useState("ncbi"); // State to hold selected source

    const [files, setFiles] = useState({
        file_sequence: null,
        file_annotation : null,
    });
    const [formDataNcbi, setFormDataNcbi] = useState({
        dir_output: "output_genomic",
        source: "ncbi",
        taxon: 'vertebrate_mammalian',
        species: "Homo_sapiens",
        annotation_release: "110",
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
    const [formDataEns, setFormDataEns] = useState({
        dir_output: "output_genomic",
        source: "ensembl",
        species: "Homo_sapiens",
        annotation_release: "current",
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
    const [formDataCustom, setFormDataCustom] = useState({
        dir_output: "output_genomic",
        source: "custom",
        file_annotation: '',
        file_sequence: '',
        species: "Homo_sapiens",
        annotation_release: "110",
        genome_assembly: "GRCh38",
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
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;

        if (!selectedFiles) return;

        // @ts-ignore
        setFiles((prevFiles) => {
            // Check if the input field should support multiple files
             // For single-file inputs, replace the existing file
            return {
                ...prevFiles,
                [name]: selectedFiles[0],
            };
        });
    };
    const uploadFiles = async () => {
        const filePaths: { [key: string]: string } = {};
        console.log(files,'from the event');
        for (const key in files) {
            // @ts-ignore
            if (files[key]) {
                const formData = new FormData();
                // @ts-ignore
                if (Array.isArray(files[key])) {
                    console.log(`Processing multiple files for key: ${key}`);
                    let paths = []; // Temporary array to collect file paths
                    // @ts-ignore
                    for (const file of files[key]) { // Use for...of to iterate over the array
                        console.log(file);
                        const formData = new FormData();
                        formData.append("file", file);
                        // Perform upload logic here
                        try {
                            const response = await axios.post(
                                "http://localhost:5000/api/upload",
                                formData,
                                {
                                    headers: { "Content-Type": "multipart/form-data" },
                                }
                            );
                            paths.push(response.data.filePath); // Append the returned file path
                        } catch (error) {
                            console.error(`Error uploading ${key}:`, error);
                        }
                    }
                    filePaths[key] = paths.join("\n");
                } else {
                    // @ts-ignore
                    formData.append("file", files[key]);
                    // @ts-ignore
                    console.log(files[key],key,'what it look like not array');
                    try {
                        const response = await axios.post(
                            "http://localhost:5000/api/upload",
                            formData,
                            {
                                headers: { "Content-Type": "multipart/form-data" },
                            }
                        );
                        filePaths[key] = response.data.filePath;
                        // Save the returned file path
                    } catch (error) {
                        console.error(`Error uploading ${key}:`, error);
                    }
                }
            }
        }
        console.log(filePaths);
        return filePaths;
    };
    const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedSource(e.target.value);
    };



    return (
        <div>
            <Navbar/>
            <div className="container py-5">
                <h2 className="text-center mb-5"> Genomic Region Generator </h2>

                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <div className="card shadow-lg border-0 rounded-lg">
                            <div className="card-header bg-primary text-white text-center">
                                <h4>Select Data Source</h4>
                            </div>
                            <div className="card-body p-4">

                                {/* Source Selection */}
                                <div className="btn-group w-100 mb-4" role="group">
                                    <input
                                        type="radio"
                                        className="btn-check"
                                        id="ncbi"
                                        name="source"
                                        value="ncbi"
                                        checked={selectedSource === "ncbi"}
                                        onChange={handleSourceChange}
                                    />
                                    <label
                                        className={`btn btn-outline-primary ${selectedSource === "ncbi" ? "active" : ""}`}
                                        htmlFor="ncbi">
                                        🧬 NCBI
                                    </label>

                                    <input
                                        type="radio"
                                        className="btn-check"
                                        id="ensembl"
                                        name="source"
                                        value="ensembl"
                                        checked={selectedSource === "ensembl"}
                                        onChange={handleSourceChange}
                                    />
                                    <label
                                        className={`btn btn-outline-success ${selectedSource === "ensembl" ? "active" : ""}`}
                                        htmlFor="ensembl">
                                        🔬 Ensembl
                                    </label>

                                    <input
                                        type="radio"
                                        className="btn-check"
                                        id="custom"
                                        name="source"
                                        value="custom"
                                        checked={selectedSource === "custom"}
                                        onChange={handleSourceChange}
                                    />
                                    <label
                                        className={`btn btn-outline-warning ${selectedSource === "custom" ? "active" : ""}`}
                                        htmlFor="custom">
                                        📂 Custom
                                    </label>
                                </div>

                                {/* Dynamic Info Box */}
                                <div className="alert alert-info text-center" role="alert">
                                    <strong>Selected Source:</strong> {selectedSource.toUpperCase()}
                                </div>

                                {/* Placeholder for Dynamic Forms */}
                                <div className="mt-4">
                                    {selectedSource === "ncbi" && (
                                        <div className="alert alert-primary">
                                            <h5>🧬 NCBI Settings</h5>
                                            <p>Configure genomic regions using NCBI databases.</p>
                                        </div>
                                    )}
                                    {selectedSource === "ensembl" && (
                                        <div className="alert alert-success">
                                            <h5>🔬 Ensembl Settings</h5>
                                            <p>Configure genomic regions using Ensembl databases.</p>
                                        </div>
                                    )}
                                    {selectedSource === "custom" && (
                                        <div className="alert alert-warning">
                                            <h5>📂 Custom Upload</h5>
                                            <p>Upload your custom annotation and sequence files.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="d-flex justify-content-center mt-4">
                                    <button className="btn btn-outline-secondary me-3">Reset</button>
                                    <button className="btn btn-success">Proceed 🚀</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

    );
};

export default Genomic;