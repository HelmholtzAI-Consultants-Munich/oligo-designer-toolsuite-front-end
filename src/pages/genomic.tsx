import React, {useState} from "react";
import Navbar from "../modules/nav";
import axios from "axios";
const Genomic: React.FC = () => {
    const [selectedSource, setSelectedSource] = useState("ncbi"); // State to hold selected source
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [files, setFiles] = useState({
        file_sequence: null,
        file_annotation : null,
    });
    const areAllFilesUploaded = () => {
        return (
            files.file_sequence !== null &&
            files.file_annotation !== null
        );
    };
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const {name, value} = e.target;
        if (selectedSource === 'ncbi') {
            setFormDataNcbi({...formDataNcbi, [name]: value});

        }
        if (selectedSource === 'ensembl'){
            setFormDataEns({...formDataEns, [name]: value});

        }
        if (selectedSource === 'custom'){
            setFormDataCustom({...formDataCustom, [name]: value});

        }


    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let finalFormData;
        try {
            // Send formData to the backend

            if (selectedSource === 'ncbi'){
                finalFormData = formDataNcbi }
            if (selectedSource === 'ensembl'){
                finalFormData = formDataEns }
            if (selectedSource === 'custom'){
                if (!areAllFilesUploaded()) {
                    alert('Please upload all required files before submitting.');
                    return;
                }

                const uploadedPaths = await uploadFiles();
                finalFormData = {
                    ...formDataCustom,
                    ...uploadedPaths, // Include uploaded file paths
                };
            }
            console.log(finalFormData);

            const response = await axios.post('http://localhost:5000/api/genomic/' + selectedSource, finalFormData,
                {
                    headers: {"Content-Type": "application/json"},
                });
            alert('Form submitted successfully!');
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Error submitting form. Please try again.');
        }
    };
    const [formDataNcbi, setFormDataNcbi] = useState({
        dir_output: "output_genomic",
        source: "ncbi",
        taxon: 'vertebrate_mammalian',
        species: "Homo_sapiens",
        annotation_release: "110",
        exon_exon_junction_block_size: 50,
        gene: 'False',
        intergenic: 'False',
        exon: 'False',
        exon_exon_junction: 'False',
        UTR: 'False',
        CDS: 'False',
        intron: 'False'
    });
    const [formDataEns, setFormDataEns] = useState({
        dir_output: "output_genomic",
        source: "ensembl",
        species: "Homo_sapiens",
        annotation_release: "current",
        exon_exon_junction_block_size: 50,
        gene: 'False',
        intergenic: 'False',
        exon: 'False',
        exon_exon_junction: 'False',
        UTR: 'False',
        CDS: 'False',
        intron: 'False'
    });
    const [formDataCustom, setFormDataCustom] = useState({
        dir_output: "output_genomic",
        source: "custom",
        file_annotation: '',
        file_sequence: '',
        files_source: '',
        species: "",
        annotation_release: "",
        genome_assembly: "",
        exon_exon_junction_block_size: 50,

        gene: 'False',
        intergenic: 'False',
        exon: 'False',
        exon_exon_junction: 'False',
        UTR: 'False',
        CDS: 'False',
        intron: 'False'
    });
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;

        if (!selectedFiles) return;

        // @ts-ignore
        setFiles((prevFiles) => {
            // Check if the input field should support multiple files
            if (name === "files_fasta_target_probe_database" || name === "files_fasta_reference_database_target_probe") {
                // @ts-ignore
                return {
                };
            } else {
                // For single-file inputs, replace the existing file
                return {
                    ...prevFiles,
                    [name]: selectedFiles[0],
                };
            }
        });
    };
    const uploadFiles = async () => {
        const filePaths: { [key: string]: string } = {};
        console.log(files,'from the event');
        for (const key in files) {
            console.log(key);
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
                        console.log(key,'OUR KEY');
                        filePaths[key] = response.data.filePath;
                        // Save the returned file path
                    } catch (error) {
                        console.error(`Error uploading ${key}:`, error);
                    }
                }
            }
        }
        console.log(filePaths,'these are the paths');
        return filePaths;
    };
    const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedSource(e.target.value);
    };



    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
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
                                        🗄️ NCBI
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
                                        🗄️ Ensembl
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

                                {/* Dynamic Content */}
                                <div className="mt-4">
                                    {selectedSource === "ncbi" && (
                                        <div className="card shadow-sm mb-4 border-primary">
                                            <div className="card-header bg-primary text-white">
                                                <h5>🧬 NCBI Configuration</h5>
                                            </div>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="mb-3">
                                                        <label htmlFor="taxon" className="form-label">Taxon</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            id="taxon"
                                                            value={formDataNcbi.taxon}
                                                            onChange={handleChange}
                                                            placeholder="vertebrate_mammalian"
                                                        />
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="species" className="form-label">Species</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            id="species"
                                                            value={formDataNcbi.species}
                                                            onChange={handleChange}
                                                            placeholder="Homo_sapiens"
                                                        />
                                                    </div>


                                                    <div className="mb-3">
                                                        <label htmlFor="annotation_release" className="form-label">Annotation
                                                            Release</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="annotation_release"
                                                            value={formDataNcbi.annotation_release}
                                                            onChange={handleChange}
                                                            placeholder="current"
                                                        />
                                                    </div>

                                                    {formDataNcbi.exon_exon_junction === "true" && (
                                                        <div className="mb-3">
                                                            <label htmlFor="exon_exon_junction_block_size" className="form-label">
                                                                Exon-Exon Junction Block Size
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                id="exon_exon_junction_block_size"
                                                                value={formDataEns.exon_exon_junction_block_size}
                                                                onChange={handleChange}
                                                                placeholder="50"
                                                            />
                                                        </div>
                                                    )}

                                                    <h5>Genomic Regions</h5>

                                                    <div className="row">
                                                        {["gene", "intergenic", "exon", "exon_exon_junction", "UTR", "CDS", "intron"].map((region) => (
                                                            <div className="col-md-4 mb-3" key={region}>
                                                                <div className="form-check">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        id={region}
                                                                        name={region}
                                                                        checked={formDataNcbi[region as keyof typeof formDataNcbi] === "true"}
                                                                        onChange={(e) =>
                                                                            setFormDataNcbi((prev) => ({
                                                                                ...prev,
                                                                                [region]: e.target.checked ? "true" : "false",
                                                                            }))
                                                                        }
                                                                    />
                                                                    <label htmlFor={region}
                                                                           className="form-check-label">
                                                                        {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, " ")}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button type="submit" className="btn btn-primary">Submit

                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    {selectedSource === "ensembl" && (
                                        <div className="card shadow-sm mb-4 border-success">
                                            <div className="card-header bg-success text-white">
                                                <h5>🔬 Ensembl Configuration</h5>
                                            </div>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="mb-3">
                                                        <label htmlFor="species" className="form-label">Species</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            id="species"
                                                            value={formDataEns.species}
                                                            onChange={handleChange}
                                                            placeholder="Homo_sapiens"
                                                        />
                                                    </div>

                                                    <div className="mb-3">
                                                        <label htmlFor="annotation_release" className="form-label">Annotation
                                                            Release</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="annotation_release"
                                                            value={formDataEns.annotation_release}
                                                            onChange={handleChange}
                                                            placeholder="current"
                                                        />
                                                    </div>

                                                    {formDataEns.exon_exon_junction === "true" && (
                                                        <div className="mb-3">
                                                            <label htmlFor="exon_exon_junction_block_size" className="form-label">
                                                                Exon-Exon Junction Block Size
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                id="exon_exon_junction_block_size"
                                                                value={formDataEns.exon_exon_junction_block_size}
                                                                onChange={handleChange}
                                                                placeholder="50"
                                                            />
                                                        </div>
                                                    )}

                                                    <h5>Genomic Regions</h5>

                                                    <div className="row">
                                                        {["gene", "intergenic", "exon", "exon_exon_junction", "UTR", "CDS", "intron"].map((region) => (
                                                            <div className="col-md-4 mb-3" key={region}>
                                                                <div className="form-check">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        id={region}
                                                                        name={region}
                                                                        checked={formDataEns[region as keyof typeof formDataEns] === "true"}
                                                                        onChange={(e) =>
                                                                            setFormDataEns((prev) => ({
                                                                                ...prev,
                                                                                [region]: e.target.checked ? "true" : "false",
                                                                            }))
                                                                        }
                                                                    />
                                                                    <label htmlFor={region}
                                                                           className="form-check-label">
                                                                        {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, " ")}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button type="submit" className="btn btn-primary">Submit

                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    {selectedSource === "custom" && (
                                        <div className="card shadow-sm mb-4 border-warning">
                                            <div className="card-header bg-warning text-dark">
                                                <h5>📂 Custom Data Upload</h5>
                                            </div>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="mb-3">
                                                        <label htmlFor="file_sequence" className="form-label">Upload
                                                            Sequence File</label>
                                                        <input type="file" className="form-control" id="file_sequence"
                                                               name='file_sequence'
                                                               onChange={handleFileChange}/>
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="file_annotation" className="form-label">Upload
                                                            Annotation File</label>
                                                        <input type="file" className="form-control"
                                                               name='file_annotation'
                                                               id="file_annotation" onChange={handleFileChange}/>
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="species" className="form-label">Species</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            id="species"
                                                            value={formDataCustom.species}
                                                            onChange={handleChange}
                                                            placeholder=""
                                                        />
                                                    </div>

                                                    <div className="mb-3">
                                                        <label htmlFor="annotation_release" className="form-label">Annotation
                                                            Release</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="annotation_release"
                                                            value={formDataCustom.annotation_release}
                                                            onChange={handleChange}
                                                            placeholder=""
                                                        />
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="genome_assembly" className="form-label">Annotation
                                                            Release</label>
                                                        <input
                                                            type='text'
                                                            className="form-control"
                                                            id="genome_assembly"
                                                            value={formDataCustom.genome_assembly}
                                                            onChange={handleChange}
                                                            placeholder=""
                                                        />
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="files_source" className="form-label">Files
                                                            Source
                                                        </label>
                                                        <input
                                                            type='text'
                                                            className="form-control"
                                                            id="files_source"
                                                            value={formDataCustom.files_source}
                                                            onChange={handleChange}
                                                            placeholder=""
                                                        />
                                                    </div>

                                                    {formDataCustom.exon_exon_junction === "true" && (
                                                        <div className="mb-3">
                                                            <label htmlFor="exon_exon_junction_block_size"
                                                                   className="form-label">
                                                                Exon-Exon Junction Block Size
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                id="exon_exon_junction_block_size"
                                                                value={formDataEns.exon_exon_junction_block_size}
                                                                onChange={handleChange}
                                                                placeholder="50"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="row">
                                                        {["gene", "intergenic", "exon", "exon_exon_junction", "UTR", "CDS", "intron"].map((region) => (
                                                            <div className="col-md-4 mb-3" key={region}>
                                                                <div className="form-check">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        id={region}
                                                                        name={region}
                                                                        checked={formDataCustom[region as keyof typeof formDataCustom] === "true"}
                                                                        onChange={(e) =>
                                                                            setFormDataCustom((prev) => ({
                                                                                ...prev,
                                                                                [region]: e.target.checked ? "true" : "false",
                                                                            }))
                                                                        }
                                                                    />
                                                                    <label htmlFor={region}
                                                                           className="form-check-label">
                                                                        {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, " ")}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="container my-4">
                                                        <form onSubmit={handleSubmit} id="scrinshotForm">
                                                            {/* File upload inputs */}
                                                            {/* ... */}
                                                            {!areAllFilesUploaded() && (
                                                                <div className="alert alert-warning mt-3">
                                                                    Please upload all required files before submitting.
                                                                </div>
                                                            )}
                                                            <div className="d-flex justify-content-center mt-3">
                                                                <button
                                                                    type="submit"
                                                                    className="btn btn-primary"
                                                                    disabled={isSubmitting || !areAllFilesUploaded()}
                                                                >
                                                                    {isSubmitting ? "Running..." : "Submit"}
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}
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