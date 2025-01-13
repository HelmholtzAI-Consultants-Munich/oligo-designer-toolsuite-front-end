import React, {useState} from "react";
import Navbar from "../modules/nav";
import axios from "axios";

const Merfish = () => {
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [files, setFiles] = useState({
        file_regions: null,
        files_fasta_target_probe_database: null,
        files_fasta_reference_database_target_probe : null,
    });
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;

        if (!selectedFiles) return;

        // @ts-ignore
        setFiles((prevFiles) => {
            // Check if the input field should support multiple files
            if (name === "files_fasta_target_probe_database" || name === "files_fasta_reference_database_target_probe") {
                return {
                    ...prevFiles,
                    [name]: [...(prevFiles[name] || []), ...Array.from(selectedFiles)], // Append new files to existing ones
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
    return(
        <Navbar/>
    )

}
export default Merfish;