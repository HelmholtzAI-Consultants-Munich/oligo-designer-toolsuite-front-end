import React from "react";
import { useState } from "react";
import axios from "axios";

const FileHandling: React.FC = () => {
  interface FileState {
    file_regions_file: File | null;
    files_fasta_target_probe_database: File[]; // Always an array
    files_fasta_reference_database_target_probe: File[]; // Always an array
    files_fasta_reference_database_readout_probe: File[]; // Always an array
    files_fasta_reference_database_primer: File[]; // Always an array
  }

  const [files, setFiles] = useState<FileState>({
    file_regions_file: null,
    files_fasta_target_probe_database: [], // Empty array
    files_fasta_reference_database_target_probe: [], // Empty array
    files_fasta_reference_database_readout_probe: [], // Empty array
    files_fasta_reference_database_primer: [], // Empty array
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files: selectedFiles } = e.target;
    if (!selectedFiles) return;

    setFiles((prevFiles: FileState) => ({
      ...prevFiles,
      [name]:
        name === "file_regions" ? selectedFiles[0] : Array.from(selectedFiles),
    }));
  };

  const uploadFiles = async (formData: any) => {
    const filePaths: { [key: string]: string } = {};
    for (const key in files) {
      // @ts-ignore
      if (files[key]) {
        const formDataU = new FormData();
        // @ts-ignore
        if (Array.isArray(files[key])) {
          console.log(`Processing multiple files for key: ${key}`);
          let paths = []; // Temporary array to collect file paths
          // @ts-ignore
          for (const file of files[key]) {
            // Use for...of to iterate over the array
            console.log(file);
            const formDataU = new FormData();
            formDataU.append("file", file);
            // Perform upload logic here
            try {
              const response = await axios.post(
                "http://localhost:5000/api/upload",
                formDataU,
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
          if (formData.file_regions.value.length === 0) {
            // @ts-ignore
            formDataU.append("file", files[key]);
            // @ts-ignore
            console.log(files[key], key, "what it look like not array");
            try {
              const response = await axios.post(
                "http://localhost:5000/api/upload",
                formDataU,
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
    }
  };
  return <p>hallo</p>;
};
export default FileHandling;
