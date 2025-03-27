import React, {useState} from "react";
import Navbar from "../modules/nav";
import axios from "axios";
import genomic_custom_form from "../forms/genomic_custom_form";
import genomic_ncbi_form from "../forms/genomic_ncbi_form";
import genomic_ens_form from "../forms/genomic_ens_form";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import form_Data_Custom from "../forms/genomic_custom_form";
const Genomic: React.FC = () => {
    const [fileReady, setFileReady] = useState(false);

    const [selectedSource, setSelectedSource] = useState("ncbi"); // State to hold selected source
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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
    const handleDownload = async () => {
        try {
            const response = await axios.post('http://localhost:5000/api/genomic/ncbi', FormData, {
                responseType: 'blob' // Important: Treat response as a file
            });

            // Create a download link for the file
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'genomic_output.fasta'); // Adjust filename as needed
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
            alert("Error downloading the file.");
        }
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

            setLoading(true); // Start loading animation

            // Determine which formData to send
            if (selectedSource === 'ncbi') {
                finalFormData = formDataNcbi;
            } else if (selectedSource === 'ensembl') {
                finalFormData = formDataEns;
            } else if (selectedSource === 'custom') {
                if (!areAllFilesUploaded()) {
                    alert('Please upload all required files before submitting.');
                    setLoading(false); // Stop loading if validation fails
                    return;
                }

                const uploadedPaths = await uploadFiles();
                for (const key in uploadedPaths) {
                    // @ts-ignore
                    if (finalFormData[key]) {
                        // Preserve the existing comment and update the value with the uploaded path
                        // @ts-ignore

                        finalFormData[key] = {
                            value: uploadedPaths[key], // Update the value with the uploaded path
                            // @ts-ignore
                            comment: finalFormData[key].comment, // Preserve the existing comment
                        };
                    } else {
                        // If the key doesn't exist in formData, create a new entry with an empty comment
                        // @ts-ignore
                        finalFormData[key] = {
                            value: uploadedPaths[key],
                            comment: "",
                        };
                    }
                }
            }

            console.log(finalFormData);

            // Send the request
            const response = await axios.post('http://localhost:5000/api/genomic/' + selectedSource, finalFormData, {
                headers: { "Content-Type": "application/json" },
            });

            alert('Form submitted successfully!');

            // Extract file URL from response and set download URL
            if (response.data?.fileUrl) {
                setDownloadUrl(response.data.fileUrl);
            }

        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Error submitting form. Please try again.');
        } finally {
            setLoading(false); // Stop loading
        }
    };
    const [formDataNcbi, setFormDataNcbi] = useState(form_Data_Ncbi);
    const [formDataEns, setFormDataEns] = useState(form_Data_Ens);
    const [formDataCustom, setFormDataCustom] = useState(form_Data_Custom);
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
                        filePaths[key] = response.data.filePath;
                        // Save the returned file path
                    } catch (error) {
                        console.error(`Error uploading ${key}:`, error);
                    }
                }
            }
        }
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
                            <div className="card-header text-center">
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
                                            <div className="card-header ">
                                                <h5>NCBI Configuration</h5>
                                            </div>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="mb-3">
                                                        <label htmlFor="taxon" className="form-label">Taxon</label>
                                                        <select
                                                            className="form-select"
                                                            id="taxon"
                                                            name="taxon"
                                                            value={formDataNcbi.source_params.taxon.value}
                                                            onChange={handleChange}
                                                        >
                                                            <option value="vertebrate_mammalian">Vertebrate Mammalian
                                                            </option>
                                                            <option value="archaea">Archaea</option>
                                                            <option value="bacteria">Bacteria</option>
                                                            <option value="fungi">Fungi</option>
                                                            <option value="invertebrate">Invertebrate</option>
                                                            <option value="metagenomes">Metagenomes</option>
                                                            <option value="mitochondrion">Mitochondrion</option>
                                                            <option value="plant">Plant</option>
                                                            <option value="plasmid">Plasmid</option>
                                                            <option value="plastid">Plastid</option>
                                                            <option value="protozoa">Protozoa</option>
                                                            <option value="unknown">Unknown</option>

                                                            <option value="vertebrate_other">Vertebrate Other</option>
                                                            <option value="viral">Viral</option>
                                                        </select>
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="species" className="form-label">Species</label>

                                                        {formDataNcbi.source_params.taxon.value === "vertebrate_mammalian" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    {/* Fill with mammalian species */}
                                                                    <option value="Acinonyx_jubatus">Acinonyx jubatus
                                                                    </option>
                                                                    <option value="Acomys_russatus">Acomys russatus
                                                                    </option>
                                                                    <option value="Ailuropoda_melanoleuca">Ailuropoda
                                                                        melanoleuca
                                                                    </option>
                                                                    <option value="Alexandromys_fortis">Alexandromys
                                                                        fortis
                                                                    </option>
                                                                    <option value="Antechinus_flavipes">Antechinus
                                                                        flavipes
                                                                    </option>
                                                                    <option value="Aotus_nancymaae">Aotus nancymaae
                                                                    </option>
                                                                    <option value="Apodemus_sylvaticus">Apodemus
                                                                        sylvaticus
                                                                    </option>
                                                                    <option value="Artibeus_jamaicensis">Artibeus
                                                                        jamaicensis
                                                                    </option>
                                                                    <option value="Arvicanthis_niloticus">Arvicanthis
                                                                        niloticus
                                                                    </option>
                                                                    <option value="Arvicola_amphibius">Arvicola
                                                                        amphibius
                                                                    </option>
                                                                    <option
                                                                        value="Balaenoptera_acutorostrata">Balaenoptera
                                                                        acutorostrata
                                                                    </option>
                                                                    <option value="Balaenoptera_musculus">Balaenoptera
                                                                        musculus
                                                                    </option>
                                                                    <option value="Balaenoptera_ricei">Balaenoptera
                                                                        ricei
                                                                    </option>
                                                                    <option value="Bison_bison">Bison bison</option>
                                                                    <option value="Bos_indicus">Bos indicus</option>
                                                                    <option value="Bos_indicus_x_Bos_taurus">Bos indicus
                                                                        x
                                                                        Bos taurus
                                                                    </option>
                                                                    <option value="Bos_javanicus">Bos javanicus</option>
                                                                    <option value="Bos_mutus">Bos mutus</option>
                                                                    <option value="Bos_taurus">Bos taurus</option>
                                                                    <option value="Bubalus_bubalis">Bubalus bubalis
                                                                    </option>
                                                                    <option value="Bubalus_kerabau">Bubalus kerabau
                                                                    </option>
                                                                    <option value="Budorcas_taxicolor">Budorcas
                                                                        taxicolor
                                                                    </option>
                                                                    <option value="Callithrix_jacchus">Callithrix
                                                                        jacchus
                                                                    </option>
                                                                    <option value="Callorhinus_ursinus">Callorhinus
                                                                        ursinus
                                                                    </option>
                                                                    <option value="Camelus_bactrianus">Camelus
                                                                        bactrianus
                                                                    </option>
                                                                    <option value="Camelus_dromedarius">Camelus
                                                                        dromedarius
                                                                    </option>
                                                                    <option value="Camelus_ferus">Camelus ferus</option>
                                                                    <option value="Canis_lupus_dingo">Canis lupus dingo
                                                                    </option>
                                                                    <option value="Canis_lupus_familiaris">Canis lupus
                                                                        familiaris
                                                                    </option>
                                                                    <option value="Capra_hircus">Capra hircus</option>
                                                                    <option value="Capricornis_sumatraensis">Capricornis
                                                                        sumatraensis
                                                                    </option>
                                                                    <option value="Carlito_syrichta">Carlito syrichta
                                                                    </option>
                                                                    <option value="Castor_canadensis">Castor canadensis
                                                                    </option>
                                                                    <option value="Cavia_porcellus">Cavia porcellus
                                                                    </option>
                                                                    <option value="Cebus_imitator">Cebus imitator
                                                                    </option>
                                                                    <option value="Ceratotherium_simum">Ceratotherium
                                                                        simum
                                                                    </option>
                                                                    <option value="Cercocebus_atys">Cercocebus atys
                                                                    </option>
                                                                    <option value="Cervus_canadensis">Cervus canadensis
                                                                    </option>
                                                                    <option value="Cervus_elaphus">Cervus elaphus
                                                                    </option>
                                                                    <option value="Chinchilla_lanigera">Chinchilla
                                                                        lanigera
                                                                    </option>
                                                                    <option value="Chionomys_nivalis">Chionomys nivalis
                                                                    </option>
                                                                    <option value="Chlorocebus_sabaeus">Chlorocebus
                                                                        sabaeus
                                                                    </option>
                                                                    <option value="Choloepus_didactylus">Choloepus
                                                                        didactylus
                                                                    </option>
                                                                    <option value="Chrysochloris_asiatica">Chrysochloris
                                                                        asiatica
                                                                    </option>
                                                                    <option value="Colobus_angolensis">Colobus
                                                                        angolensis
                                                                    </option>
                                                                    <option value="Condylura_cristata">Condylura
                                                                        cristata
                                                                    </option>
                                                                    <option value="Cricetulus_griseus">Cricetulus
                                                                        griseus
                                                                    </option>
                                                                    <option value="Cynocephalus_volans">Cynocephalus
                                                                        volans
                                                                    </option>
                                                                    <option value="Dama_dama">Dama dama</option>
                                                                    <option value="Dasypus_novemcinctus">Dasypus
                                                                        novemcinctus
                                                                    </option>
                                                                    <option value="Delphinapterus_leucas">Delphinapterus
                                                                        leucas
                                                                    </option>
                                                                    <option value="Delphinus_delphis">Delphinus delphis
                                                                    </option>
                                                                    <option value="Desmodus_rotundus">Desmodus rotundus
                                                                    </option>
                                                                    <option value="Diceros_bicornis">Diceros bicornis
                                                                    </option>
                                                                    <option value="Dipodomys_merriami">Dipodomys
                                                                        merriami
                                                                    </option>
                                                                    <option value="Dipodomys_ordii">Dipodomys ordii
                                                                    </option>
                                                                    <option value="Dipodomys_spectabilis">Dipodomys
                                                                        spectabilis
                                                                    </option>
                                                                    <option value="Dromiciops_gliroides">Dromiciops
                                                                        gliroides
                                                                    </option>
                                                                    <option value="Echinops_telfairi">Echinops telfairi
                                                                    </option>
                                                                    <option value="Elephantulus_edwardii">Elephantulus
                                                                        edwardii
                                                                    </option>
                                                                    <option value="Elephas_maximus">Elephas maximus
                                                                    </option>
                                                                    <option value="Enhydra_lutris">Enhydra lutris
                                                                    </option>
                                                                    <option value="Eptesicus_fuscus">Eptesicus fuscus
                                                                    </option>
                                                                    <option value="Equus_asinus">Equus asinus</option>
                                                                    <option value="Equus_caballus">Equus caballus
                                                                    </option>
                                                                    <option value="Equus_przewalskii">Equus przewalskii
                                                                    </option>
                                                                    <option value="Equus_quagga">Equus quagga</option>
                                                                    <option value="Erinaceus_europaeus">Erinaceus
                                                                        europaeus
                                                                    </option>
                                                                    <option value="Eschrichtius_robustus">Eschrichtius
                                                                        robustus
                                                                    </option>
                                                                    <option value="Eubalaena_glacialis">Eubalaena
                                                                        glacialis
                                                                    </option>
                                                                    <option value="Eulemur_rufifrons">Eulemur rufifrons
                                                                    </option>
                                                                    <option value="Eumetopias_jubatus">Eumetopias
                                                                        jubatus
                                                                    </option>
                                                                    <option value="Felis_catus">Felis catus</option>
                                                                    <option value="Fukomys_damarensis">Fukomys
                                                                        damarensis
                                                                    </option>
                                                                    <option value="Galeopterus_variegatus">Galeopterus
                                                                        variegatus
                                                                    </option>
                                                                    <option value="Globicephala_melas">Globicephala
                                                                        melas
                                                                    </option>
                                                                    <option value="Gorilla_gorilla">Gorilla gorilla
                                                                    </option>
                                                                    <option value="Gracilinanus_agilis">Gracilinanus
                                                                        agilis
                                                                    </option>
                                                                    <option value="Grammomys_surdaster">Grammomys
                                                                        surdaster
                                                                    </option>
                                                                    <option value="Halichoerus_grypus">Halichoerus
                                                                        grypus
                                                                    </option>
                                                                    <option value="Heterocephalus_glaber">Heterocephalus
                                                                        glaber
                                                                    </option>
                                                                    <option value="Hippopotamus_amphibius">Hippopotamus
                                                                        amphibius
                                                                    </option>
                                                                    <option value="Hipposideros_armiger">Hipposideros
                                                                        armiger
                                                                    </option>
                                                                    <option value="Homo_sapiens">Homo sapiens</option>
                                                                    <option value="Hyaena_hyaena">Hyaena hyaena</option>
                                                                    <option value="Hylobates_moloch">Hylobates moloch
                                                                    </option>
                                                                    <option value="Ictidomys_tridecemlineatus">Ictidomys
                                                                        tridecemlineatus
                                                                    </option>
                                                                    <option value="Jaculus_jaculus">Jaculus jaculus
                                                                    </option>
                                                                    <option value="Kogia_breviceps">Kogia breviceps
                                                                    </option>
                                                                    <option
                                                                        value="Lagenorhynchus_albirostris">Lagenorhynchus
                                                                        albirostris
                                                                    </option>
                                                                    <option value="Lemur_catta">Lemur catta</option>
                                                                    <option value="Leopardus_geoffroyi">Leopardus
                                                                        geoffroyi
                                                                    </option>
                                                                    <option
                                                                        value="Leptonychotes_weddellii">Leptonychotes
                                                                        weddellii
                                                                    </option>
                                                                    <option value="Lepus_europaeus">Lepus europaeus
                                                                    </option>
                                                                    <option value="Lipotes_vexillifer">Lipotes
                                                                        vexillifer
                                                                    </option>
                                                                    <option value="Lontra_canadensis">Lontra canadensis
                                                                    </option>
                                                                    <option value="Loxodonta_africana">Loxodonta
                                                                        africana
                                                                    </option>
                                                                    <option value="Lutra_lutra">Lutra lutra</option>
                                                                    <option value="Lynx_canadensis">Lynx canadensis
                                                                    </option>
                                                                    <option value="Lynx_rufus">Lynx rufus</option>
                                                                    <option value="Macaca_fascicularis">Macaca
                                                                        fascicularis
                                                                    </option>
                                                                    <option value="Macaca_mulatta">Macaca mulatta
                                                                    </option>
                                                                    <option value="Macaca_nemestrina">Macaca nemestrina
                                                                    </option>
                                                                    <option value="Macaca_thibetana">Macaca thibetana
                                                                    </option>
                                                                    <option value="Mandrillus_leucophaeus">Mandrillus
                                                                        leucophaeus
                                                                    </option>
                                                                    <option value="Manis_javanica">Manis javanica
                                                                    </option>
                                                                    <option value="Manis_pentadactyla">Manis
                                                                        pentadactyla
                                                                    </option>
                                                                    <option value="Marmota_flaviventris">Marmota
                                                                        flaviventris
                                                                    </option>
                                                                    <option value="Marmota_marmota">Marmota marmota
                                                                    </option>
                                                                    <option value="Marmota_monax">Marmota monax</option>
                                                                    <option value="Mastomys_coucha">Mastomys coucha
                                                                    </option>
                                                                    <option value="Meles_meles">Meles meles</option>
                                                                    <option value="Meriones_unguiculatus">Meriones
                                                                        unguiculatus
                                                                    </option>
                                                                    <option value="Mesocricetus_auratus">Mesocricetus
                                                                        auratus
                                                                    </option>
                                                                    <option value="Mesoplodon_densirostris">Mesoplodon
                                                                        densirostris
                                                                    </option>
                                                                    <option value="Microcebus_murinus">Microcebus
                                                                        murinus
                                                                    </option>
                                                                    <option value="Microtus_ochrogaster">Microtus
                                                                        ochrogaster
                                                                    </option>
                                                                    <option value="Microtus_oregoni">Microtus oregoni
                                                                    </option>
                                                                    <option value="Miniopterus_natalensis">Miniopterus
                                                                        natalensis
                                                                    </option>
                                                                    <option value="Mirounga_angustirostris">Mirounga
                                                                        angustirostris
                                                                    </option>
                                                                    <option value="Mirounga_leonina">Mirounga leonina
                                                                    </option>
                                                                    <option value="Molossus_molossus">Molossus molossus
                                                                    </option>
                                                                    <option value="Monodelphis_domestica">Monodelphis
                                                                        domestica
                                                                    </option>
                                                                    <option value="Monodon_monoceros">Monodon monoceros
                                                                    </option>
                                                                    <option value="Moschus_berezovskii">Moschus
                                                                        berezovskii
                                                                    </option>
                                                                    <option value="Muntiacus_reevesi">Muntiacus reevesi
                                                                    </option>
                                                                    <option value="Mus_caroli">Mus caroli</option>
                                                                    <option value="Mus_musculus">Mus musculus</option>
                                                                    <option value="Mus_pahari">Mus pahari</option>
                                                                    <option value="Mustela_erminea">Mustela erminea
                                                                    </option>
                                                                    <option value="Mustela_lutreola">Mustela lutreola
                                                                    </option>
                                                                    <option value="Mustela_nigripes">Mustela nigripes
                                                                    </option>
                                                                    <option value="Mustela_putorius">Mustela putorius
                                                                    </option>
                                                                    <option value="Myodes_glareolus">Myodes glareolus
                                                                    </option>
                                                                    <option value="Myotis_brandtii">Myotis brandtii
                                                                    </option>
                                                                    <option value="Myotis_daubentonii">Myotis
                                                                        daubentonii
                                                                    </option>
                                                                    <option value="Myotis_davidii">Myotis davidii
                                                                    </option>
                                                                    <option value="Myotis_lucifugus">Myotis lucifugus
                                                                    </option>
                                                                    <option value="Myotis_myotis">Myotis myotis</option>
                                                                    <option value="Myotis_yumanensis">Myotis yumanensis
                                                                    </option>
                                                                    <option value="Nannospalax_galili">Nannospalax
                                                                        galili
                                                                    </option>
                                                                    <option value="Neofelis_nebulosa">Neofelis nebulosa
                                                                    </option>
                                                                    <option value="Neogale_vison">Neogale vison</option>
                                                                    <option
                                                                        value="Neomonachus_schauinslandi">Neomonachus
                                                                        schauinslandi
                                                                    </option>
                                                                    <option
                                                                        value="Neophocaena_asiaeorientalis">Neophocaena
                                                                        asiaeorientalis
                                                                    </option>
                                                                    <option value="Nomascus_leucogenys">Nomascus
                                                                        leucogenys
                                                                    </option>
                                                                    <option value="Nyctereutes_procyonoides">Nyctereutes
                                                                        procyonoides
                                                                    </option>
                                                                    <option value="Nycticebus_coucang">Nycticebus
                                                                        coucang
                                                                    </option>
                                                                    <option value="Ochotona_curzoniae">Ochotona
                                                                        curzoniae
                                                                    </option>
                                                                    <option value="Ochotona_princeps">Ochotona princeps
                                                                    </option>
                                                                    <option value="Octodon_degus">Octodon degus</option>
                                                                    <option value="Odobenus_rosmarus">Odobenus rosmarus
                                                                    </option>
                                                                    <option value="Odocoileus_virginianus">Odocoileus
                                                                        virginianus
                                                                    </option>
                                                                    <option value="Onychomys_torridus">Onychomys
                                                                        torridus
                                                                    </option>
                                                                    <option value="Orcinus_orca">Orcinus orca</option>
                                                                    <option
                                                                        value="Ornithorhynchus_anatinus">Ornithorhynchus
                                                                        anatinus
                                                                    </option>
                                                                    <option value="Orycteropus_afer">Orycteropus afer
                                                                    </option>
                                                                    <option value="Oryctolagus_cuniculus">Oryctolagus
                                                                        cuniculus
                                                                    </option>
                                                                    <option value="Oryx_dammah">Oryx dammah</option>
                                                                    <option value="Otolemur_garnettii">Otolemur
                                                                        garnettii
                                                                    </option>
                                                                    <option value="Ovis_aries">Ovis aries</option>
                                                                    <option value="Ovis_canadensis">Ovis canadensis
                                                                    </option>
                                                                    <option value="Pan_paniscus">Pan paniscus</option>
                                                                    <option value="Pan_troglodytes">Pan troglodytes
                                                                    </option>
                                                                    <option value="Panthera_leo">Panthera leo</option>
                                                                    <option value="Panthera_onca">Panthera onca</option>
                                                                    <option value="Panthera_pardus">Panthera pardus
                                                                    </option>
                                                                    <option value="Panthera_tigris">Panthera tigris
                                                                    </option>
                                                                    <option value="Panthera_uncia">Panthera uncia
                                                                    </option>
                                                                    <option value="Pantholops_hodgsonii">Pantholops
                                                                        hodgsonii
                                                                    </option>
                                                                    <option value="Papio_anubis">Papio anubis</option>
                                                                    <option value="Perognathus_longimembris">Perognathus
                                                                        longimembris
                                                                    </option>
                                                                    <option value="Peromyscus_californicus">Peromyscus
                                                                        californicus
                                                                    </option>
                                                                    <option value="Peromyscus_eremicus">Peromyscus
                                                                        eremicus
                                                                    </option>
                                                                    <option value="Peromyscus_leucopus">Peromyscus
                                                                        leucopus
                                                                    </option>
                                                                    <option value="Peromyscus_maniculatus">Peromyscus
                                                                        maniculatus
                                                                    </option>
                                                                    <option value="Petaurus_breviceps">Petaurus
                                                                        breviceps
                                                                    </option>
                                                                    <option value="Phacochoerus_africanus">Phacochoerus
                                                                        africanus
                                                                    </option>
                                                                    <option value="Phascolarctos_cinereus">Phascolarctos
                                                                        cinereus
                                                                    </option>
                                                                    <option value="Phoca_vitulina">Phoca vitulina
                                                                    </option>
                                                                    <option value="Phocoena_phocoena">Phocoena phocoena
                                                                    </option>
                                                                    <option value="Phocoena_sinus">Phocoena sinus
                                                                    </option>
                                                                    <option value="Phodopus_roborovskii">Phodopus
                                                                        roborovskii
                                                                    </option>
                                                                    <option value="Phyllostomus_discolor">Phyllostomus
                                                                        discolor
                                                                    </option>
                                                                    <option value="Phyllostomus_hastatus">Phyllostomus
                                                                        hastatus
                                                                    </option>
                                                                    <option value="Physeter_macrocephalus">Physeter
                                                                        macrocephalus
                                                                    </option>
                                                                    <option
                                                                        value="Piliocolobus_tephrosceles">Piliocolobus
                                                                        tephrosceles
                                                                    </option>
                                                                    <option value="Pipistrellus_kuhlii">Pipistrellus
                                                                        kuhlii
                                                                    </option>
                                                                    <option value="Pongo_abelii">Pongo abelii</option>
                                                                    <option value="Pongo_pygmaeus">Pongo pygmaeus
                                                                    </option>
                                                                    <option
                                                                        value="Prionailurus_bengalensis">Prionailurus
                                                                        bengalensis
                                                                    </option>
                                                                    <option value="Prionailurus_viverrinus">Prionailurus
                                                                        viverrinus
                                                                    </option>
                                                                    <option value="Propithecus_coquereli">Propithecus
                                                                        coquereli
                                                                    </option>
                                                                    <option value="Psammomys_obesus">Psammomys obesus
                                                                    </option>
                                                                    <option value="Pseudorca_crassidens">Pseudorca
                                                                        crassidens
                                                                    </option>
                                                                    <option value="Pteronotus_mesoamericanus">Pteronotus
                                                                        mesoamericanus
                                                                    </option>
                                                                    <option value="Pteropus_alecto">Pteropus alecto
                                                                    </option>
                                                                    <option value="Pteropus_medius">Pteropus medius
                                                                    </option>
                                                                    <option value="Pteropus_vampyrus">Pteropus vampyrus
                                                                    </option>
                                                                    <option value="Puma_concolor">Puma concolor</option>
                                                                    <option value="Puma_yagouaroundi">Puma yagouaroundi
                                                                    </option>
                                                                    <option value="Rattus_norvegicus">Rattus norvegicus
                                                                    </option>
                                                                    <option value="Rattus_rattus">Rattus rattus</option>
                                                                    <option
                                                                        value="Rhinolophus_ferrumequinum">Rhinolophus
                                                                        ferrumequinum
                                                                    </option>
                                                                    <option value="Rhinolophus_sinicus">Rhinolophus
                                                                        sinicus
                                                                    </option>
                                                                    <option value="Rhinopithecus_bieti">Rhinopithecus
                                                                        bieti
                                                                    </option>
                                                                    <option
                                                                        value="Rhinopithecus_roxellana">Rhinopithecus
                                                                        roxellana
                                                                    </option>
                                                                    <option value="Rousettus_aegyptiacus">Rousettus
                                                                        aegyptiacus
                                                                    </option>
                                                                    <option value="Saccopteryx_bilineata">Saccopteryx
                                                                        bilineata
                                                                    </option>
                                                                    <option value="Saccopteryx_leptura">Saccopteryx
                                                                        leptura
                                                                    </option>
                                                                    <option value="Sagmatias_obliquidens">Sagmatias
                                                                        obliquidens
                                                                    </option>
                                                                    <option value="Saimiri_boliviensis">Saimiri
                                                                        boliviensis
                                                                    </option>
                                                                    <option value="Sapajus_apella">Sapajus apella
                                                                    </option>
                                                                    <option value="Sarcophilus_harrisii">Sarcophilus
                                                                        harrisii
                                                                    </option>
                                                                    <option value="Sciurus_carolinensis">Sciurus
                                                                        carolinensis
                                                                    </option>
                                                                    <option value="Sorex_araneus">Sorex araneus</option>
                                                                    <option value="Sorex_cinereus">Sorex cinereus
                                                                    </option>
                                                                    <option value="Sorex_fumeus">Sorex fumeus</option>
                                                                    <option value="Sturnira_hondurensis">Sturnira
                                                                        hondurensis
                                                                    </option>
                                                                    <option value="Suncus_etruscus">Suncus etruscus
                                                                    </option>
                                                                    <option value="Suricata_suricatta">Suricata
                                                                        suricatta
                                                                    </option>
                                                                    <option value="Sus_scrofa">Sus scrofa</option>
                                                                    <option
                                                                        value="Symphalangus_syndactylus">Symphalangus
                                                                        syndactylus
                                                                    </option>
                                                                    <option value="Tachyglossus_aculeatus">Tachyglossus
                                                                        aculeatus
                                                                    </option>
                                                                    <option value="Talpa_occidentalis">Talpa
                                                                        occidentalis
                                                                    </option>
                                                                    <option
                                                                        value="Trachypithecus_francoisi">Trachypithecus
                                                                        francoisi
                                                                    </option>
                                                                    <option value="Trichechus_manatus">Trichechus
                                                                        manatus
                                                                    </option>
                                                                    <option value="Trichosurus_vulpecula">Trichosurus
                                                                        vulpecula
                                                                    </option>
                                                                    <option value="Tupaia_chinensis">Tupaia chinensis
                                                                    </option>
                                                                    <option value="Tursiops_truncatus">Tursiops
                                                                        truncatus
                                                                    </option>
                                                                    <option value="Urocitellus_parryii">Urocitellus
                                                                        parryii
                                                                    </option>
                                                                    <option value="Ursus_americanus">Ursus americanus
                                                                    </option>
                                                                    <option value="Ursus_arctos">Ursus arctos</option>
                                                                    <option value="Ursus_maritimus">Ursus maritimus
                                                                    </option>
                                                                    <option value="Vicugna_pacos">Vicugna pacos</option>
                                                                    <option value="Vombatus_ursinus">Vombatus ursinus
                                                                    </option>
                                                                    <option value="Vulpes_lagopus">Vulpes lagopus
                                                                    </option>
                                                                    <option value="Vulpes_vulpes">Vulpes vulpes</option>
                                                                    <option value="Zalophus_californianus">Zalophus
                                                                        californianus
                                                                    </option>
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "archaea" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option value="Halopelagius_fulvigenes">Halopelagius
                                                                        fulvigenes
                                                                    </option>
                                                                    <option
                                                                        value="Halopelagius_inordinatus">Halopelagius
                                                                        inordinatus
                                                                    </option>
                                                                    <option value="Halopelagius_longus">Halopelagius
                                                                        longus
                                                                    </option>
                                                                    <option value="Halopenitus_malekzadehii">Halopenitus
                                                                        malekzadehii
                                                                    </option>
                                                                    <option value="Halopenitus_persicus">Halopenitus
                                                                        persicus
                                                                    </option>
                                                                    <option value="Halopenitus_salinus">Halopenitus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Halopenitus_sp">Halopenitus sp
                                                                    </option>
                                                                    <option value="Halopenitus_sp">Halopenitus sp
                                                                    </option>
                                                                    <option value="Halopiger_aswanensis">Halopiger
                                                                        aswanensis
                                                                    </option>
                                                                    <option
                                                                        value="Halopiger_djelfimassiliensis">Halopiger
                                                                        djelfimassiliensis
                                                                    </option>
                                                                    <option
                                                                        value="Halopiger_goleimassiliensis">Halopiger
                                                                        goleimassiliensis
                                                                    </option>
                                                                    <option value="Halopiger_xanaduensis">Halopiger
                                                                        xanaduensis
                                                                    </option>
                                                                    <option value="Haloplanus_aerogenes">Haloplanus
                                                                        aerogenes
                                                                    </option>
                                                                    <option value="Haloplanus_litoreus">Haloplanus
                                                                        litoreus
                                                                    </option>
                                                                    <option value="Haloplanus_natans">Haloplanus
                                                                        natans
                                                                    </option>
                                                                    <option value="Haloplanus_rallus">Haloplanus
                                                                        rallus
                                                                    </option>
                                                                    <option value="Haloplanus_ruber">Haloplanus ruber
                                                                    </option>
                                                                    <option value="Haloplanus_rubicundus">Haloplanus
                                                                        rubicundus
                                                                    </option>
                                                                    <option value="Haloplanus_salinarum">Haloplanus
                                                                        salinarum
                                                                    </option>
                                                                    <option value="Haloplanus_salinus">Haloplanus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_sp">Haloplanus sp</option>
                                                                    <option value="Haloplanus_vescus">Haloplanus
                                                                        vescus
                                                                    </option>
                                                                    <option value="Haloprofundus_halobius">Haloprofundus
                                                                        halobius
                                                                    </option>
                                                                    <option
                                                                        value="Haloprofundus_halophilus">Haloprofundus
                                                                        halophilus
                                                                    </option>
                                                                    <option
                                                                        value="Haloprofundus_marisrubri">Haloprofundus
                                                                        marisrubri
                                                                    </option>
                                                                    <option
                                                                        value="Haloprofundus_salilacus">Haloprofundus
                                                                        salilacus
                                                                    </option>
                                                                    <option
                                                                        value="Haloprofundus_salinisoli">Haloprofundus
                                                                        salinisoli
                                                                    </option>
                                                                    <option value="Haloprofundus_sp">Haloprofundus sp
                                                                    </option>
                                                                    <option value="Haloquadratum_sp">Haloquadratum sp
                                                                    </option>
                                                                    <option value="Haloquadratum_walsbyi">Haloquadratum
                                                                        walsbyi
                                                                    </option>
                                                                    <option value="Halorarius_halobius">Halorarius
                                                                        halobius
                                                                    </option>
                                                                    <option value="Halorarius_litoreus">Halorarius
                                                                        litoreus
                                                                    </option>
                                                                    <option value="Halorarum_halophilum">Halorarum
                                                                        halophilum
                                                                    </option>
                                                                    <option value="Halorarum_salinum">Halorarum
                                                                        salinum
                                                                    </option>
                                                                    <option value="Halorhabdus_amylolytica">Halorhabdus
                                                                        amylolytica
                                                                    </option>
                                                                    <option value="Halorhabdus_rudnickae">Halorhabdus
                                                                        rudnickae
                                                                    </option>
                                                                    <option value="Halorhabdus_salina">Halorhabdus
                                                                        salina
                                                                    </option>
                                                                    <option value="Halorhabdus_sp">Halorhabdus sp
                                                                    </option>
                                                                    <option value="Halorhabdus_sp">Halorhabdus sp
                                                                    </option>
                                                                    <option value="Halorhabdus_sp">Halorhabdus sp
                                                                    </option>
                                                                    <option value="Halorhabdus_sp">Halorhabdus sp
                                                                    </option>
                                                                    <option value="Halorhabdus_tiamatea">Halorhabdus
                                                                        tiamatea
                                                                    </option>
                                                                    <option value="Halorhabdus_utahensis">Halorhabdus
                                                                        utahensis
                                                                    </option>
                                                                    <option value="Halorientalis_brevis">Halorientalis
                                                                        brevis
                                                                    </option>
                                                                    <option
                                                                        value="Halorientalis_halophila">Halorientalis
                                                                        halophila
                                                                    </option>
                                                                    <option value="Halorientalis_litorea">Halorientalis
                                                                        litorea
                                                                    </option>
                                                                    <option value="Halorientalis_marina">Halorientalis
                                                                        marina
                                                                    </option>
                                                                    <option value="Halorientalis_pallida">Halorientalis
                                                                        pallida
                                                                    </option>
                                                                    <option value="Halorientalis_persicus">Halorientalis
                                                                        persicus
                                                                    </option>
                                                                    <option
                                                                        value="Halorientalis_regularis">Halorientalis
                                                                        regularis
                                                                    </option>
                                                                    <option value="Halorientalis_salina">Halorientalis
                                                                        salina
                                                                    </option>
                                                                    <option value="Halorientalis_sp">Halorientalis sp
                                                                    </option>
                                                                    <option value="Halorientalis_sp">Halorientalis sp
                                                                    </option>
                                                                    <option value="Halorubellus_litoreus">Halorubellus
                                                                        litoreus
                                                                    </option>
                                                                    <option value="Halorubellus_salinus">Halorubellus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Halorubellus_sp">Halorubellus sp
                                                                    </option>
                                                                    <option value="Halorubellus_sp">Halorubellus sp
                                                                    </option>
                                                                    <option value="Halorubrum_aethiopicum">Halorubrum
                                                                        aethiopicum
                                                                    </option>
                                                                    <option value="Halorubrum_aidingense">Halorubrum
                                                                        aidingense
                                                                    </option>
                                                                    <option value="Halorubrum_alkaliphilum">Halorubrum
                                                                        alkaliphilum
                                                                    </option>
                                                                    <option value="Halorubrum_amylolyticum">Halorubrum
                                                                        amylolyticum
                                                                    </option>
                                                                    <option value="Halorubrum_aquaticum">Halorubrum
                                                                        aquaticum
                                                                    </option>
                                                                    <option value="Halorubrum_arcis">Halorubrum arcis
                                                                    </option>
                                                                    <option value="Halorubrum_californiense">Halorubrum
                                                                        californiense
                                                                    </option>
                                                                    <option value="Halorubrum_cibi">Halorubrum cibi
                                                                    </option>
                                                                    <option value="Halorubrum_coriense">Halorubrum
                                                                        coriense
                                                                    </option>
                                                                    <option value="Halorubrum_depositum">Halorubrum
                                                                        depositum
                                                                    </option>
                                                                    <option value="Halorubrum_distributum">Halorubrum
                                                                        distributum
                                                                    </option>
                                                                    <option value="Halorubrum_ejinorense">Halorubrum
                                                                        ejinorense
                                                                    </option>
                                                                    <option value="Halorubrum_ezzemoulense">Halorubrum
                                                                        ezzemoulense
                                                                    </option>
                                                                    <option value="Halorubrum_glutamatedens">Halorubrum
                                                                        glutamatedens
                                                                    </option>
                                                                    <option value="Halorubrum_halodurans">Halorubrum
                                                                        halodurans
                                                                    </option>
                                                                    <option value="Halorubrum_halophilum">Halorubrum
                                                                        halophilum
                                                                    </option>
                                                                    <option value="Halorubrum_hochsteinianum">Halorubrum
                                                                        hochsteinianum
                                                                    </option>
                                                                    <option value="Halorubrum_hochstenium">Halorubrum
                                                                        hochstenium
                                                                    </option>
                                                                    <option value="Halorubrum_kocurii">Halorubrum
                                                                        kocurii
                                                                    </option>
                                                                    <option value="Halorubrum_lacusprofundi">Halorubrum
                                                                        lacusprofundi
                                                                    </option>
                                                                    <option value="Halorubrum_laminariae">Halorubrum
                                                                        laminariae
                                                                    </option>
                                                                    <option value="Halorubrum_lipolyticum">Halorubrum
                                                                        lipolyticum
                                                                    </option>
                                                                    <option value="Halorubrum_litoreum">Halorubrum
                                                                        litoreum
                                                                    </option>
                                                                    <option value="Halorubrum_miltondacostae">Halorubrum
                                                                        miltondacostae
                                                                    </option>
                                                                    <option value="Halorubrum_persicum">Halorubrum
                                                                        persicum
                                                                    </option>
                                                                    <option value="Halorubrum_ruber">Halorubrum ruber
                                                                    </option>
                                                                    <option value="Halorubrum_rubrum">Halorubrum
                                                                        rubrum
                                                                    </option>
                                                                    <option value="Halorubrum_rutilum">Halorubrum
                                                                        rutilum
                                                                    </option>
                                                                    <option value="Halorubrum_saccharovorum">Halorubrum
                                                                        saccharovorum
                                                                    </option>
                                                                    <option value="Halorubrum_salinarum">Halorubrum
                                                                        salinarum
                                                                    </option>
                                                                    <option value="Halorubrum_salinum">Halorubrum
                                                                        salinum
                                                                    </option>
                                                                    <option value="Halorubrum_salipaludis">Halorubrum
                                                                        salipaludis
                                                                    </option>
                                                                    <option value="Halorubrum_salsamenti">Halorubrum
                                                                        salsamenti
                                                                    </option>
                                                                    <option value="Halorubrum_sodomense">Halorubrum
                                                                        sodomense
                                                                    </option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_sp">Halorubrum sp</option>
                                                                    <option value="Halorubrum_tebenquichense">Halorubrum
                                                                        tebenquichense
                                                                    </option>
                                                                    <option value="Halorubrum_terrestre">Halorubrum
                                                                        terrestre
                                                                    </option>
                                                                    <option value="Halorubrum_tibetense">Halorubrum
                                                                        tibetense
                                                                    </option>
                                                                    <option value="Halorubrum_trapanicum">Halorubrum
                                                                        trapanicum
                                                                    </option>
                                                                    <option value="Halorubrum_tropicale">Halorubrum
                                                                        tropicale
                                                                    </option>
                                                                    <option value="Halorubrum_trueperi">Halorubrum
                                                                        trueperi
                                                                    </option>
                                                                    <option value="Halorubrum_vacuolatum">Halorubrum
                                                                        vacuolatum
                                                                    </option>
                                                                    <option value="Halorubrum_xinjiangense">Halorubrum
                                                                        xinjiangense
                                                                    </option>
                                                                    <option value="Halorubrum_yunnanense">Halorubrum
                                                                        yunnanense
                                                                    </option>
                                                                    <option value="Halorussus_amylolyticus">Halorussus
                                                                        amylolyticus
                                                                    </option>
                                                                    <option value="Halorussus_aquaticus">Halorussus
                                                                        aquaticus
                                                                    </option>
                                                                    <option value="Halorussus_caseinilyticus">Halorussus
                                                                        caseinilyticus
                                                                    </option>
                                                                    <option
                                                                        value="Halorussus_gelatinilyticus">Halorussus
                                                                        gelatinilyticus
                                                                    </option>
                                                                    <option value="Halorussus_halobius">Halorussus
                                                                        halobius
                                                                    </option>
                                                                    <option value="Halorussus_halophilus">Halorussus
                                                                        halophilus
                                                                    </option>
                                                                    <option value="Halorussus_limi">Halorussus limi
                                                                    </option>
                                                                    <option value="Halorussus_lipolyticus">Halorussus
                                                                        lipolyticus
                                                                    </option>
                                                                    <option value="Halorussus_litoreus">Halorussus
                                                                        litoreus
                                                                    </option>
                                                                    <option value="Halorussus_marinus">Halorussus
                                                                        marinus
                                                                    </option>
                                                                    <option value="Halorussus_pelagicus">Halorussus
                                                                        pelagicus
                                                                    </option>
                                                                    <option value="Halorussus_rarus">Halorussus rarus
                                                                    </option>
                                                                    <option value="Halorussus_ruber">Halorussus ruber
                                                                    </option>
                                                                    <option value="Halorussus_salilacus">Halorussus
                                                                        salilacus
                                                                    </option>
                                                                    <option value="Halorussus_salinisoli">Halorussus
                                                                        salinisoli
                                                                    </option>
                                                                    <option value="Halorussus_salinus">Halorussus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Halorussus_sp">Halorussus sp</option>
                                                                    <option value="Halorussus_sp">Halorussus sp</option>
                                                                    <option value="Halorussus_sp">Halorussus sp</option>
                                                                    <option value="Halorussus_vallis">Halorussus
                                                                        vallis
                                                                    </option>
                                                                    <option value="Halorutilus_salinus">Halorutilus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Halosegnis_longus">Halosegnis
                                                                        longus
                                                                    </option>
                                                                    <option value="Halosegnis_marinus">Halosegnis
                                                                        marinus
                                                                    </option>
                                                                    <option value="Halosegnis_rubeus">Halosegnis
                                                                        rubeus
                                                                    </option>
                                                                    <option value="Halosegnis_sp">Halosegnis sp</option>
                                                                    <option value="Halosimplex_aquaticum">Halosimplex
                                                                        aquaticum
                                                                    </option>
                                                                    <option value="Halosimplex_carlsbadense">Halosimplex
                                                                        carlsbadense
                                                                    </option>
                                                                    <option value="Halosimplex_halophilum">Halosimplex
                                                                        halophilum
                                                                    </option>
                                                                    <option value="Halosimplex_litoreum">Halosimplex
                                                                        litoreum
                                                                    </option>
                                                                    <option value="Halosimplex_pelagicum">Halosimplex
                                                                        pelagicum
                                                                    </option>
                                                                    <option value="Halosimplex_rubrum">Halosimplex
                                                                        rubrum
                                                                    </option>
                                                                    <option value="Halosimplex_salinum">Halosimplex
                                                                        salinum
                                                                    </option>
                                                                    <option value="Halosimplex_sp">Halosimplex sp
                                                                    </option>
                                                                    <option value="Halosolutus_amylolyticus">Halosolutus
                                                                        amylolyticus
                                                                    </option>
                                                                    <option
                                                                        value="Halosolutus_gelatinilyticus">Halosolutus
                                                                        gelatinilyticus
                                                                    </option>
                                                                    <option value="Halosolutus_halophilus">Halosolutus
                                                                        halophilus
                                                                    </option>
                                                                    <option value="Halospeciosus_flavus">Halospeciosus
                                                                        flavus
                                                                    </option>
                                                                    <option
                                                                        value="Halostagnicola_kamekurae">Halostagnicola
                                                                        kamekurae
                                                                    </option>
                                                                    <option
                                                                        value="Halostagnicola_larsenii">Halostagnicola
                                                                        larsenii
                                                                    </option>
                                                                    <option value="Halostagnicola_sp">Halostagnicola
                                                                        sp
                                                                    </option>
                                                                    <option value="Halostagnicola_sp">Halostagnicola
                                                                        sp
                                                                    </option>
                                                                    <option value="Halostagnicola_sp">Halostagnicola
                                                                        sp
                                                                    </option>
                                                                    <option value="Halostagnicola_sp">Halostagnicola
                                                                        sp
                                                                    </option>
                                                                    <option value="Halostella_limicola">Halostella
                                                                        limicola
                                                                    </option>
                                                                    <option value="Halostella_litorea">Halostella
                                                                        litorea
                                                                    </option>
                                                                    <option value="Halostella_pelagica">Halostella
                                                                        pelagica
                                                                    </option>
                                                                    <option value="Halostella_salina">Halostella
                                                                        salina
                                                                    </option>
                                                                    <option value="Halostella_sp">Halostella sp</option>
                                                                    <option value="Halostella_sp">Halostella sp</option>
                                                                    <option
                                                                        value="Haloterrigena_alkaliphila">Haloterrigena
                                                                        alkaliphila
                                                                    </option>
                                                                    <option
                                                                        value="Haloterrigena_gelatinilytica">Haloterrigena
                                                                        gelatinilytica
                                                                    </option>
                                                                    <option
                                                                        value="Haloterrigena_salifodinae">Haloterrigena
                                                                        salifodinae
                                                                    </option>
                                                                    <option value="Haloterrigena_salina">Haloterrigena
                                                                        salina
                                                                    </option>
                                                                    <option
                                                                        value="Haloterrigena_salinisoli">Haloterrigena
                                                                        salinisoli
                                                                    </option>
                                                                    <option value="Haloterrigena_sp">Haloterrigena sp
                                                                    </option>
                                                                    <option
                                                                        value="Haloterrigena_turkmenica">Haloterrigena
                                                                        turkmenica
                                                                    </option>
                                                                    <option value="Halovalidus_salilacus">Halovalidus
                                                                        salilacus
                                                                    </option>
                                                                    <option value="Halovenus_aranensis">Halovenus
                                                                        aranensis
                                                                    </option>
                                                                    <option value="Halovenus_carboxidivorans">Halovenus
                                                                        carboxidivorans
                                                                    </option>
                                                                    <option value="Halovenus_rubra">Halovenus rubra
                                                                    </option>
                                                                    <option value="Halovenus_salina">Halovenus salina
                                                                    </option>
                                                                    <option value="Halovenus_sp">Halovenus sp</option>
                                                                    <option value="Halovenus_sp">Halovenus sp</option>
                                                                    <option value="Halovivax_asiaticus">Halovivax
                                                                        asiaticus
                                                                    </option>
                                                                    <option value="Halovivax_cerinus">Halovivax
                                                                        cerinus
                                                                    </option>
                                                                    <option value="Halovivax_gelatinilyticus">Halovivax
                                                                        gelatinilyticus
                                                                    </option>
                                                                    <option value="Halovivax_limisalsi">Halovivax
                                                                        limisalsi
                                                                    </option>
                                                                    <option value="Halovivax_ruber">Halovivax ruber
                                                                    </option>
                                                                    <option value="Halovivax_sp">Halovivax sp</option>
                                                                    <option value="Hyperthermus_butylicus">Hyperthermus
                                                                        butylicus
                                                                    </option>
                                                                    <option value="Ignicoccus_hospitalis">Ignicoccus
                                                                        hospitalis
                                                                    </option>
                                                                    <option value="Ignicoccus_islandicus">Ignicoccus
                                                                        islandicus
                                                                    </option>
                                                                    <option value="Ignisphaera_aggregans">Ignisphaera
                                                                        aggregans
                                                                    </option>
                                                                    <option value="Ignisphaera_cupida">Ignisphaera
                                                                        cupida
                                                                    </option>
                                                                    <option value="Ignisphaera_sp">Ignisphaera sp
                                                                    </option>
                                                                    <option value="Infirmifilum_lucidum">Infirmifilum
                                                                        lucidum
                                                                    </option>
                                                                    <option value="Infirmifilum_sp">Infirmifilum sp
                                                                    </option>
                                                                    <option value="Infirmifilum_uzonense">Infirmifilum
                                                                        uzonense
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_III_euryarchaeote_SCGC_AAA">Marine
                                                                        Group III euryarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_III_euryarchaeote_SCGC_AAA">Marine
                                                                        Group III euryarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_II_euryarchaeote_SCGC_AB">Marine
                                                                        Group II euryarchaeote SCGC AB
                                                                    </option>
                                                                    <option value="Marine_Group_I_thaumarchaeote">Marine
                                                                        Group I thaumarchaeote
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AAA">Marine
                                                                        Group I thaumarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AB">Marine
                                                                        Group I thaumarchaeote SCGC AB
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_AB">Marine
                                                                        Group I thaumarchaeote SCGC AB
                                                                    </option>
                                                                    <option
                                                                        value="Marine_Group_I_thaumarchaeote_SCGC_RSA">Marine
                                                                        Group I thaumarchaeote SCGC RSA
                                                                    </option>
                                                                    <option
                                                                        value="Marine_group_II_euryarchaeote_SCGC_AAA">Marine
                                                                        group II euryarchaeote SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Metallosphaera_cuprina">Metallosphaera
                                                                        cuprina
                                                                    </option>
                                                                    <option
                                                                        value="Metallosphaera_hakonensis">Metallosphaera
                                                                        hakonensis
                                                                    </option>
                                                                    <option
                                                                        value="Metallosphaera_javensis_ex_Hofmann_et_al">Metallosphaera
                                                                        javensis ex Hofmann et al
                                                                    </option>
                                                                    <option
                                                                        value="Metallosphaera_javensis_ex_Sakai_et_al">Metallosphaera
                                                                        javensis ex Sakai et al
                                                                    </option>
                                                                    <option value="Metallosphaera_prunae">Metallosphaera
                                                                        prunae
                                                                    </option>
                                                                    <option value="Metallosphaera_sedula">Metallosphaera
                                                                        sedula
                                                                    </option>
                                                                    <option value="Metallosphaera_sp">Metallosphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Metallosphaera_sp">Metallosphaera
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Metallosphaera_tengchongensis">Metallosphaera
                                                                        tengchongensis
                                                                    </option>
                                                                    <option
                                                                        value="Metallosphaera_yellowstonensis">Metallosphaera
                                                                        yellowstonensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanimicrococcus_blatticola">Methanimicrococcus
                                                                        blatticola
                                                                    </option>
                                                                    <option
                                                                        value="Methanimicrococcus_hacksteinii">Methanimicrococcus
                                                                        hacksteinii
                                                                    </option>
                                                                    <option
                                                                        value="Methanimicrococcus_hongohii">Methanimicrococcus
                                                                        hongohii
                                                                    </option>
                                                                    <option
                                                                        value="Methanimicrococcus_stummii">Methanimicrococcus
                                                                        stummii
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacteriaceae_archaeon">Methanobacteriaceae
                                                                        archaeon
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_aggregans">Methanobacterium
                                                                        aggregans
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_alcaliphilum">Methanobacterium
                                                                        alcaliphilum
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_alkalithermotolerans">Methanobacterium
                                                                        alkalithermotolerans
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_arcticum">Methanobacterium
                                                                        arcticum
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_aridiramus">Methanobacterium
                                                                        aridiramus
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_bryantii">Methanobacterium
                                                                        bryantii
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_congolense">Methanobacterium
                                                                        congolense
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_ferruginis">Methanobacterium
                                                                        ferruginis
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_formicicum">Methanobacterium
                                                                        formicicum
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_lacus">Methanobacterium
                                                                        lacus
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_paludis">Methanobacterium
                                                                        paludis
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_petrolearium">Methanobacterium
                                                                        petrolearium
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanobacterium_sp">Methanobacterium
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_spitsbergense">Methanobacterium
                                                                        spitsbergense
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_subterraneum">Methanobacterium
                                                                        subterraneum
                                                                    </option>
                                                                    <option
                                                                        value="Methanobacterium_veterum">Methanobacterium
                                                                        veterum
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_acididurans">Methanobrevibacter
                                                                        acididurans
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_arboriphilus">Methanobrevibacter
                                                                        arboriphilus
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_boviskoreani">Methanobrevibacter
                                                                        boviskoreani
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_curvatus">Methanobrevibacter
                                                                        curvatus
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_cuticularis">Methanobrevibacter
                                                                        cuticularis
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_filiformis">Methanobrevibacter
                                                                        filiformis
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_gottschalkii">Methanobrevibacter
                                                                        gottschalkii
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_millerae">Methanobrevibacter
                                                                        millerae
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_olleyae">Methanobrevibacter
                                                                        olleyae
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_oralis">Methanobrevibacter
                                                                        oralis
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_ruminantium">Methanobrevibacter
                                                                        ruminantium
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_smithii">Methanobrevibacter
                                                                        smithii
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_sp">Methanobrevibacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_thaueri">Methanobrevibacter
                                                                        thaueri
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_woesei">Methanobrevibacter
                                                                        woesei
                                                                    </option>
                                                                    <option
                                                                        value="Methanobrevibacter_wolinii">Methanobrevibacter
                                                                        wolinii
                                                                    </option>
                                                                    <option
                                                                        value="Methanocalculus_alkaliphilus">Methanocalculus
                                                                        alkaliphilus
                                                                    </option>
                                                                    <option
                                                                        value="Methanocalculus_chunghsingensis">Methanocalculus
                                                                        chunghsingensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanocalculus_natronophilus">Methanocalculus
                                                                        natronophilus
                                                                    </option>
                                                                    <option value="Methanocalculus_sp">Methanocalculus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanocalculus_sp">Methanocalculus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanocalculus_sp">Methanocalculus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanocalculus_sp">Methanocalculus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanocalculus_taiwanensis">Methanocalculus
                                                                        taiwanensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_bathoardescens">Methanocaldococcus
                                                                        bathoardescens
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_fervens">Methanocaldococcus
                                                                        fervens
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_infernus">Methanocaldococcus
                                                                        infernus
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_jannaschii">Methanocaldococcus
                                                                        jannaschii
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_lauensis">Methanocaldococcus
                                                                        lauensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_sp">Methanocaldococcus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_sp">Methanocaldococcus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_villosus">Methanocaldococcus
                                                                        villosus
                                                                    </option>
                                                                    <option
                                                                        value="Methanocaldococcus_vulcanius">Methanocaldococcus
                                                                        vulcanius
                                                                    </option>
                                                                    <option value="Methanocella_arvoryzae">Methanocella
                                                                        arvoryzae
                                                                    </option>
                                                                    <option value="Methanocella_conradii">Methanocella
                                                                        conradii
                                                                    </option>
                                                                    <option value="Methanocella_paludicola">Methanocella
                                                                        paludicola
                                                                    </option>
                                                                    <option value="Methanocella_sp">Methanocella sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanochimaera_problematica">Methanochimaera
                                                                        problematica
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcoides_alaskense">Methanococcoides
                                                                        alaskense
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcoides_burtonii">Methanococcoides
                                                                        burtonii
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcoides_methylutens">Methanococcoides
                                                                        methylutens
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcoides_orientis">Methanococcoides
                                                                        orientis
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcoides_seepicolus">Methanococcoides
                                                                        seepicolus
                                                                    </option>
                                                                    <option value="Methanococcoides_sp">Methanococcoides
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanococcoides_sp">Methanococcoides
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanococcoides_sp">Methanococcoides
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanococcoides_sp">Methanococcoides
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanococcoides_sp">Methanococcoides
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcoides_vulcani">Methanococcoides
                                                                        vulcani
                                                                    </option>
                                                                    <option value="Methanococcus_aeolicus">Methanococcus
                                                                        aeolicus
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcus_maripaludis">Methanococcus
                                                                        maripaludis
                                                                    </option>
                                                                    <option
                                                                        value="Methanococcus_vannielii">Methanococcus
                                                                        vannielii
                                                                    </option>
                                                                    <option value="Methanococcus_voltae">Methanococcus
                                                                        voltae
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_bavaricum">Methanocorpusculum
                                                                        bavaricum
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_labreanum">Methanocorpusculum
                                                                        labreanum
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_parvum">Methanocorpusculum
                                                                        parvum
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_petauri">Methanocorpusculum
                                                                        petauri
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_sp">Methanocorpusculum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_sp">Methanocorpusculum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanocorpusculum_vombati">Methanocorpusculum
                                                                        vombati
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_bourgensis">Methanoculleus
                                                                        bourgensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_caldifontis">Methanoculleus
                                                                        caldifontis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_chikugoensis">Methanoculleus
                                                                        chikugoensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_formosensis">Methanoculleus
                                                                        formosensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_frigidifontis">Methanoculleus
                                                                        frigidifontis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_horonobensis">Methanoculleus
                                                                        horonobensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_hydrogenitrophicus">Methanoculleus
                                                                        hydrogenitrophicus
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_marisnigri">Methanoculleus
                                                                        marisnigri
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_methanifontis">Methanoculleus
                                                                        methanifontis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_nereidis">Methanoculleus
                                                                        nereidis
                                                                    </option>
                                                                    <option value="Methanoculleus_oceani">Methanoculleus
                                                                        oceani
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_receptaculi">Methanoculleus
                                                                        receptaculi
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_sediminis">Methanoculleus
                                                                        sediminis
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanoculleus_sp">Methanoculleus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_submarinus">Methanoculleus
                                                                        submarinus
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_taiwanensis">Methanoculleus
                                                                        taiwanensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoculleus_thermophilus">Methanoculleus
                                                                        thermophilus
                                                                    </option>
                                                                    <option
                                                                        value="Methanoeremita_antiquus">Methanoeremita
                                                                        antiquus
                                                                    </option>
                                                                    <option
                                                                        value="Methanofervidicoccus_abyssi">Methanofervidicoccus
                                                                        abyssi
                                                                    </option>
                                                                    <option
                                                                        value="Methanofervidicoccus_sp">Methanofervidicoccus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanofollis_aquaemaris">Methanofollis
                                                                        aquaemaris
                                                                    </option>
                                                                    <option
                                                                        value="Methanofollis_ethanolicus">Methanofollis
                                                                        ethanolicus
                                                                    </option>
                                                                    <option value="Methanofollis_fontis">Methanofollis
                                                                        fontis
                                                                    </option>
                                                                    <option
                                                                        value="Methanofollis_formosanus">Methanofollis
                                                                        formosanus
                                                                    </option>
                                                                    <option
                                                                        value="Methanofollis_liminatans">Methanofollis
                                                                        liminatans
                                                                    </option>
                                                                    <option value="Methanofollis_sp">Methanofollis sp
                                                                    </option>
                                                                    <option value="Methanofollis_sp">Methanofollis sp
                                                                    </option>
                                                                    <option value="Methanofollis_sp">Methanofollis sp
                                                                    </option>
                                                                    <option value="Methanofollis_tationis">Methanofollis
                                                                        tationis
                                                                    </option>
                                                                    <option value="Methanogenium_cariaci">Methanogenium
                                                                        cariaci
                                                                    </option>
                                                                    <option value="Methanogenium_marinum">Methanogenium
                                                                        marinum
                                                                    </option>
                                                                    <option
                                                                        value="Methanogenium_organophilum">Methanogenium
                                                                        organophilum
                                                                    </option>
                                                                    <option value="Methanogenium_sp">Methanogenium sp
                                                                    </option>
                                                                    <option value="Methanogenium_sp">Methanogenium sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalobium_evestigatum">Methanohalobium
                                                                        evestigatum
                                                                    </option>
                                                                    <option value="Methanohalobium_sp">Methanohalobium
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_euhalobius">Methanohalophilus
                                                                        euhalobius
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_halophilus">Methanohalophilus
                                                                        halophilus
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_levihalophilus">Methanohalophilus
                                                                        levihalophilus
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_mahii">Methanohalophilus
                                                                        mahii
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_portucalensis">Methanohalophilus
                                                                        portucalensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_profundi">Methanohalophilus
                                                                        profundi
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_sp">Methanohalophilus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_sp">Methanohalophilus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_sp">Methanohalophilus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_sp">Methanohalophilus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanohalophilus_sp">Methanohalophilus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanolacinia_paynteri">Methanolacinia
                                                                        paynteri
                                                                    </option>
                                                                    <option
                                                                        value="Methanolacinia_petrolearia">Methanolacinia
                                                                        petrolearia
                                                                    </option>
                                                                    <option
                                                                        value="Methanolapillus_africanus">Methanolapillus
                                                                        africanus
                                                                    </option>
                                                                    <option
                                                                        value="Methanolapillus_millepedarum">Methanolapillus
                                                                        millepedarum
                                                                    </option>
                                                                    <option
                                                                        value="Methanolapillus_ohkumae">Methanolapillus
                                                                        ohkumae
                                                                    </option>
                                                                    <option value="Methanolinea_mesophila">Methanolinea
                                                                        mesophila
                                                                    </option>
                                                                    <option value="Methanolinea_tarda">Methanolinea
                                                                        tarda
                                                                    </option>
                                                                    <option
                                                                        value="Methanolobus_bombayensis">Methanolobus
                                                                        bombayensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanolobus_chelungpuianus">Methanolobus
                                                                        chelungpuianus
                                                                    </option>
                                                                    <option
                                                                        value="Methanolobus_halotolerans">Methanolobus
                                                                        halotolerans
                                                                    </option>
                                                                    <option value="Methanolobus_mangrovi">Methanolobus
                                                                        mangrovi
                                                                    </option>
                                                                    <option value="Methanolobus_profundi">Methanolobus
                                                                        profundi
                                                                    </option>
                                                                    <option
                                                                        value="Methanolobus_psychrophilus">Methanolobus
                                                                        psychrophilus
                                                                    </option>
                                                                    <option
                                                                        value="Methanolobus_psychrotolerans">Methanolobus
                                                                        psychrotolerans
                                                                    </option>
                                                                    <option value="Methanolobus_sediminis">Methanolobus
                                                                        sediminis
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_sp">Methanolobus sp
                                                                    </option>
                                                                    <option value="Methanolobus_tindarius">Methanolobus
                                                                        tindarius
                                                                    </option>
                                                                    <option value="Methanolobus_vulcani">Methanolobus
                                                                        vulcani
                                                                    </option>
                                                                    <option value="Methanolobus_zinderi">Methanolobus
                                                                        zinderi
                                                                    </option>
                                                                    <option
                                                                        value="Methanomassiliicoccaceae_archaeon_DOK">Methanomassiliicoccaceae
                                                                        archaeon DOK
                                                                    </option>
                                                                    <option
                                                                        value="Methanomassiliicoccales_archaeon">Methanomassiliicoccales
                                                                        archaeon
                                                                    </option>
                                                                    <option
                                                                        value="Methanomassiliicoccus_luminyensis">Methanomassiliicoccus
                                                                        luminyensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanomethylophilus_alvi">Methanomethylophilus
                                                                        alvi
                                                                    </option>
                                                                    <option
                                                                        value="Methanomethylovorans_hollandica">Methanomethylovorans
                                                                        hollandica
                                                                    </option>
                                                                    <option
                                                                        value="Methanomethylovorans_sp">Methanomethylovorans
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanomethylovorans_sp">Methanomethylovorans
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanomicrobium_mobile">Methanomicrobium
                                                                        mobile
                                                                    </option>
                                                                    <option value="Methanomicrobium_sp">Methanomicrobium
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanonatronarchaeum_sp">Methanonatronarchaeum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanonatronarchaeum_sp">Methanonatronarchaeum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanonatronarchaeum_thermophilum">Methanonatronarchaeum
                                                                        thermophilum
                                                                    </option>
                                                                    <option
                                                                        value="Methanooceanicella_nereidis">Methanooceanicella
                                                                        nereidis
                                                                    </option>
                                                                    <option
                                                                        value="Methanoplanus_endosymbiosus">Methanoplanus
                                                                        endosymbiosus
                                                                    </option>
                                                                    <option value="Methanoplanus_limicola">Methanoplanus
                                                                        limicola
                                                                    </option>
                                                                    <option value="Methanopyrus_kandleri">Methanopyrus
                                                                        kandleri
                                                                    </option>
                                                                    <option value="Methanopyrus_sp">Methanopyrus sp
                                                                    </option>
                                                                    <option value="Methanopyrus_sp">Methanopyrus sp
                                                                    </option>
                                                                    <option value="Methanorbis_furvi">Methanorbis
                                                                        furvi
                                                                    </option>
                                                                    <option value="Methanorbis_rubei">Methanorbis
                                                                        rubei
                                                                    </option>
                                                                    <option value="Methanoregula_boonei">Methanoregula
                                                                        boonei
                                                                    </option>
                                                                    <option
                                                                        value="Methanoregula_formicica">Methanoregula
                                                                        formicica
                                                                    </option>
                                                                    <option value="Methanoregula_sp">Methanoregula sp
                                                                    </option>
                                                                    <option value="Methanoregula_sp">Methanoregula sp
                                                                    </option>
                                                                    <option value="Methanoregula_sp">Methanoregula sp
                                                                    </option>
                                                                    <option value="Methanoregula_sp">Methanoregula sp
                                                                    </option>
                                                                    <option value="Methanosaeta_sp">Methanosaeta sp
                                                                    </option>
                                                                    <option value="Methanosaeta_sp">Methanosaeta sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanosalsum_natronophilum">Methanosalsum
                                                                        natronophilum
                                                                    </option>
                                                                    <option value="Methanosalsum_zhilinae">Methanosalsum
                                                                        zhilinae
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_acetivorans">Methanosarcina
                                                                        acetivorans
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_baikalica">Methanosarcina
                                                                        baikalica
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_barkeri">Methanosarcina
                                                                        barkeri
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_flavescens">Methanosarcina
                                                                        flavescens
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_hadiensis">Methanosarcina
                                                                        hadiensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_horonobensis">Methanosarcina
                                                                        horonobensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_lacustris">Methanosarcina
                                                                        lacustris
                                                                    </option>
                                                                    <option value="Methanosarcina_mazei">Methanosarcina
                                                                        mazei
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_siciliae">Methanosarcina
                                                                        siciliae
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_soligelidi">Methanosarcina
                                                                        soligelidi
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosarcina_sp">Methanosarcina
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_spelaei">Methanosarcina
                                                                        spelaei
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_thermophila">Methanosarcina
                                                                        thermophila
                                                                    </option>
                                                                    <option
                                                                        value="Methanosarcina_vacuolata">Methanosarcina
                                                                        vacuolata
                                                                    </option>
                                                                    <option
                                                                        value="Methanosphaera_cuniculi">Methanosphaera
                                                                        cuniculi
                                                                    </option>
                                                                    <option value="Methanosphaera_sp">Methanosphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosphaera_sp">Methanosphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosphaera_sp">Methanosphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosphaera_sp">Methanosphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosphaera_sp">Methanosphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Methanosphaera_sp">Methanosphaera
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanosphaera_stadtmanae">Methanosphaera
                                                                        stadtmanae
                                                                    </option>
                                                                    <option
                                                                        value="Methanosphaerula_palustris">Methanosphaerula
                                                                        palustris
                                                                    </option>
                                                                    <option
                                                                        value="Methanospirillum_hungatei">Methanospirillum
                                                                        hungatei
                                                                    </option>
                                                                    <option
                                                                        value="Methanospirillum_lacunae">Methanospirillum
                                                                        lacunae
                                                                    </option>
                                                                    <option
                                                                        value="Methanospirillum_purgamenti">Methanospirillum
                                                                        purgamenti
                                                                    </option>
                                                                    <option value="Methanospirillum_sp">Methanospirillum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanospirillum_stamsii">Methanospirillum
                                                                        stamsii
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_defluvii">Methanothermobacter
                                                                        defluvii
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_marburgensis">Methanothermobacter
                                                                        marburgensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_sp">Methanothermobacter
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_tenebrarum">Methanothermobacter
                                                                        tenebrarum
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_thermautotrophicus">Methanothermobacter
                                                                        thermautotrophicus
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermobacter_wolfeii">Methanothermobacter
                                                                        wolfeii
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermococcus_okinawensis">Methanothermococcus
                                                                        okinawensis
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermococcus_sp">Methanothermococcus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermococcus_thermolithotrophicus">Methanothermococcus
                                                                        thermolithotrophicus
                                                                    </option>
                                                                    <option
                                                                        value="Methanothermus_fervidus">Methanothermus
                                                                        fervidus
                                                                    </option>
                                                                    <option
                                                                        value="Methanothrix_harundinacea">Methanothrix
                                                                        harundinacea
                                                                    </option>
                                                                    <option value="Methanothrix_soehngenii">Methanothrix
                                                                        soehngenii
                                                                    </option>
                                                                    <option value="Methanothrix_sp">Methanothrix sp
                                                                    </option>
                                                                    <option
                                                                        value="Methanothrix_thermoacetophila">Methanothrix
                                                                        thermoacetophila
                                                                    </option>
                                                                    <option
                                                                        value="Methanotorris_formicicus">Methanotorris
                                                                        formicicus
                                                                    </option>
                                                                    <option value="Methanotorris_igneus">Methanotorris
                                                                        igneus
                                                                    </option>
                                                                    <option
                                                                        value="Methanovulcanius_yangii">Methanovulcanius
                                                                        yangii
                                                                    </option>
                                                                    <option
                                                                        value="Methermicoccus_shengliensis">Methermicoccus
                                                                        shengliensis
                                                                    </option>
                                                                    <option
                                                                        value="Nanoarchaeota_archaeon_SCGC_AAA">Nanoarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Nanoarchaeota_archaeon_SCGC_AAA">Nanoarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Nanoarchaeota_archaeon_SCGC_AAA">Nanoarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Nanoarchaeota_archaeon_SCGC_AAA">Nanoarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Nanoarchaeota_archaeon_SCGC_AAA">Nanoarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option value="Nanoarchaeum_equitans">Nanoarchaeum
                                                                        equitans
                                                                    </option>
                                                                    <option value="Nanobdella_aerobiophila">Nanobdella
                                                                        aerobiophila
                                                                    </option>
                                                                    <option
                                                                        value="Natranaeroarchaeum_aerophilus">Natranaeroarchaeum
                                                                        aerophilus
                                                                    </option>
                                                                    <option
                                                                        value="Natranaeroarchaeum_sulfidigenes">Natranaeroarchaeum
                                                                        sulfidigenes
                                                                    </option>
                                                                    <option
                                                                        value="Natrarchaeobaculum_aegyptiacum">Natrarchaeobaculum
                                                                        aegyptiacum
                                                                    </option>
                                                                    <option
                                                                        value="Natrarchaeobaculum_sulfurireducens">Natrarchaeobaculum
                                                                        sulfurireducens
                                                                    </option>
                                                                    <option
                                                                        value="Natrarchaeobius_chitinivorans">Natrarchaeobius
                                                                        chitinivorans
                                                                    </option>
                                                                    <option
                                                                        value="Natrarchaeobius_halalkaliphilus">Natrarchaeobius
                                                                        halalkaliphilus
                                                                    </option>
                                                                    <option value="Natrarchaeobius_sp">Natrarchaeobius
                                                                        sp
                                                                    </option>
                                                                    <option value="Natrialba_aegyptia">Natrialba
                                                                        aegyptia
                                                                    </option>
                                                                    <option value="Natrialba_asiatica">Natrialba
                                                                        asiatica
                                                                    </option>
                                                                    <option value="Natrialba_chahannaoensis">Natrialba
                                                                        chahannaoensis
                                                                    </option>
                                                                    <option value="Natrialba_hulunbeirensis">Natrialba
                                                                        hulunbeirensis
                                                                    </option>
                                                                    <option value="Natrialba_magadii">Natrialba
                                                                        magadii
                                                                    </option>
                                                                    <option value="Natrialba_sp">Natrialba sp</option>
                                                                    <option value="Natrialba_sp">Natrialba sp</option>
                                                                    <option value="Natrialba_sp">Natrialba sp</option>
                                                                    <option value="Natrialba_swarupiae">Natrialba
                                                                        swarupiae
                                                                    </option>
                                                                    <option value="Natrialba_taiwanensis">Natrialba
                                                                        taiwanensis
                                                                    </option>
                                                                    <option
                                                                        value="Natrialbaceae_archaeon_AArc">Natrialbaceae
                                                                        archaeon AArc
                                                                    </option>
                                                                    <option value="Natribaculum_breve">Natribaculum
                                                                        breve
                                                                    </option>
                                                                    <option value="Natribaculum_longum">Natribaculum
                                                                        longum
                                                                    </option>
                                                                    <option value="Natribaculum_luteum">Natribaculum
                                                                        luteum
                                                                    </option>
                                                                    <option value="Natrinema_altunense">Natrinema
                                                                        altunense
                                                                    </option>
                                                                    <option value="Natrinema_amylolyticum">Natrinema
                                                                        amylolyticum
                                                                    </option>
                                                                    <option value="Natrinema_caseinilyticum">Natrinema
                                                                        caseinilyticum
                                                                    </option>
                                                                    <option value="Natrinema_ejinorense">Natrinema
                                                                        ejinorense
                                                                    </option>
                                                                    <option value="Natrinema_gari">Natrinema gari
                                                                    </option>
                                                                    <option value="Natrinema_gelatinilyticum">Natrinema
                                                                        gelatinilyticum
                                                                    </option>
                                                                    <option value="Natrinema_halophilum">Natrinema
                                                                        halophilum
                                                                    </option>
                                                                    <option value="Natrinema_hispanicum">Natrinema
                                                                        hispanicum
                                                                    </option>
                                                                    <option value="Natrinema_limicola">Natrinema
                                                                        limicola
                                                                    </option>
                                                                    <option value="Natrinema_longum">Natrinema longum
                                                                    </option>
                                                                    <option value="Natrinema_mahii">Natrinema mahii
                                                                    </option>
                                                                    <option value="Natrinema_marinum">Natrinema
                                                                        marinum
                                                                    </option>
                                                                    <option value="Natrinema_pallidum">Natrinema
                                                                        pallidum
                                                                    </option>
                                                                    <option value="Natrinema_pellirubrum">Natrinema
                                                                        pellirubrum
                                                                    </option>
                                                                    <option value="Natrinema_saccharevitans">Natrinema
                                                                        saccharevitans
                                                                    </option>
                                                                    <option value="Natrinema_salaciae">Natrinema
                                                                        salaciae
                                                                    </option>
                                                                    <option value="Natrinema_salifodinae">Natrinema
                                                                        salifodinae
                                                                    </option>
                                                                    <option value="Natrinema_salinisoli">Natrinema
                                                                        salinisoli
                                                                    </option>
                                                                    <option value="Natrinema_salsiterrestre">Natrinema
                                                                        salsiterrestre
                                                                    </option>
                                                                    <option value="Natrinema_soli">Natrinema soli
                                                                    </option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_sp">Natrinema sp</option>
                                                                    <option value="Natrinema_thermotolerans">Natrinema
                                                                        thermotolerans
                                                                    </option>
                                                                    <option value="Natrinema_versiforme">Natrinema
                                                                        versiforme
                                                                    </option>
                                                                    <option value="Natrinema_zhouii">Natrinema zhouii
                                                                    </option>
                                                                    <option
                                                                        value="Natronoarchaeum_mannanilyticum">Natronoarchaeum
                                                                        mannanilyticum
                                                                    </option>
                                                                    <option
                                                                        value="Natronoarchaeum_philippinense">Natronoarchaeum
                                                                        philippinense
                                                                    </option>
                                                                    <option
                                                                        value="Natronoarchaeum_rubrum">Natronoarchaeum
                                                                        rubrum
                                                                    </option>
                                                                    <option value="Natronoarchaeum_sp">Natronoarchaeum
                                                                        sp
                                                                    </option>
                                                                    <option value="Natronoarchaeum_sp">Natronoarchaeum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Natronobacterium_gregoryi">Natronobacterium
                                                                        gregoryi
                                                                    </option>
                                                                    <option
                                                                        value="Natronobacterium_texcoconense">Natronobacterium
                                                                        texcoconense
                                                                    </option>
                                                                    <option
                                                                        value="Natronobeatus_ordinarius">Natronobeatus
                                                                        ordinarius
                                                                    </option>
                                                                    <option
                                                                        value="Natronobiforma_cellulositropha">Natronobiforma
                                                                        cellulositropha
                                                                    </option>
                                                                    <option
                                                                        value="Natronocalculus_amylovorans">Natronocalculus
                                                                        amylovorans
                                                                    </option>
                                                                    <option
                                                                        value="Natronococcus_amylolyticus">Natronococcus
                                                                        amylolyticus
                                                                    </option>
                                                                    <option value="Natronococcus_jeotgali">Natronococcus
                                                                        jeotgali
                                                                    </option>
                                                                    <option value="Natronococcus_occultus">Natronococcus
                                                                        occultus
                                                                    </option>
                                                                    <option value="Natronococcus_pandeyae">Natronococcus
                                                                        pandeyae
                                                                    </option>
                                                                    <option value="Natronococcus_roseus">Natronococcus
                                                                        roseus
                                                                    </option>
                                                                    <option value="Natronococcus_sp">Natronococcus sp
                                                                    </option>
                                                                    <option value="Natronococcus_sp">Natronococcus sp
                                                                    </option>
                                                                    <option value="Natronococcus_sp">Natronococcus sp
                                                                    </option>
                                                                    <option value="Natronococcus_sp">Natronococcus sp
                                                                    </option>
                                                                    <option value="Natronococcus_wangiae">Natronococcus
                                                                        wangiae
                                                                    </option>
                                                                    <option value="Natronococcus_zhouii">Natronococcus
                                                                        zhouii
                                                                    </option>
                                                                    <option
                                                                        value="Natronoglomus_mannanivorans">Natronoglomus
                                                                        mannanivorans
                                                                    </option>
                                                                    <option
                                                                        value="Natronolimnobius_baerhuensis">Natronolimnobius
                                                                        baerhuensis
                                                                    </option>
                                                                    <option value="Natronolimnobius_sp">Natronolimnobius
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Natronolimnohabitans_innermongolicus">Natronolimnohabitans
                                                                        innermongolicus
                                                                    </option>
                                                                    <option
                                                                        value="Natronolimnohabitans_sp">Natronolimnohabitans
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Natronomonas_amylolytica">Natronomonas
                                                                        amylolytica
                                                                    </option>
                                                                    <option value="Natronomonas_aquatica">Natronomonas
                                                                        aquatica
                                                                    </option>
                                                                    <option
                                                                        value="Natronomonas_gomsonensis">Natronomonas
                                                                        gomsonensis
                                                                    </option>
                                                                    <option value="Natronomonas_halophila">Natronomonas
                                                                        halophila
                                                                    </option>
                                                                    <option value="Natronomonas_marina">Natronomonas
                                                                        marina
                                                                    </option>
                                                                    <option
                                                                        value="Natronomonas_moolapensis">Natronomonas
                                                                        moolapensis
                                                                    </option>
                                                                    <option value="Natronomonas_pharaonis">Natronomonas
                                                                        pharaonis
                                                                    </option>
                                                                    <option value="Natronomonas_salina">Natronomonas
                                                                        salina
                                                                    </option>
                                                                    <option value="Natronomonas_salsuginis">Natronomonas
                                                                        salsuginis
                                                                    </option>
                                                                    <option value="Natronomonas_sp">Natronomonas sp
                                                                    </option>
                                                                    <option value="Natronomonas_sp">Natronomonas sp
                                                                    </option>
                                                                    <option value="Natronomonas_sp">Natronomonas sp
                                                                    </option>
                                                                    <option
                                                                        value="Natrononativus_amylolyticus">Natrononativus
                                                                        amylolyticus
                                                                    </option>
                                                                    <option value="Natronorarus_salvus">Natronorarus
                                                                        salvus
                                                                    </option>
                                                                    <option value="Natronorubrum_aibiense">Natronorubrum
                                                                        aibiense
                                                                    </option>
                                                                    <option value="Natronorubrum_bangense">Natronorubrum
                                                                        bangense
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_daqingense">Natronorubrum
                                                                        daqingense
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_halalkaliphilum">Natronorubrum
                                                                        halalkaliphilum
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_halophilum">Natronorubrum
                                                                        halophilum
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_sediminis">Natronorubrum
                                                                        sediminis
                                                                    </option>
                                                                    <option value="Natronorubrum_sp">Natronorubrum sp
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_sulfidifaciens">Natronorubrum
                                                                        sulfidifaciens
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_texcoconense">Natronorubrum
                                                                        texcoconense
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_thiooxidans">Natronorubrum
                                                                        thiooxidans
                                                                    </option>
                                                                    <option
                                                                        value="Natronorubrum_tibetense">Natronorubrum
                                                                        tibetense
                                                                    </option>
                                                                    <option
                                                                        value="Natronosalvus_amylolyticus">Natronosalvus
                                                                        amylolyticus
                                                                    </option>
                                                                    <option
                                                                        value="Natronosalvus_caseinilyticus">Natronosalvus
                                                                        caseinilyticus
                                                                    </option>
                                                                    <option value="Natronosalvus_halobius">Natronosalvus
                                                                        halobius
                                                                    </option>
                                                                    <option
                                                                        value="Natronosalvus_hydrolyticus">Natronosalvus
                                                                        hydrolyticus
                                                                    </option>
                                                                    <option value="Natronosalvus_rutilus">Natronosalvus
                                                                        rutilus
                                                                    </option>
                                                                    <option value="Natronosalvus_vescus">Natronosalvus
                                                                        vescus
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosarchaeum_koreense">Nitrosarchaeum
                                                                        koreense
                                                                    </option>
                                                                    <option value="Nitrosarchaeum_sp">Nitrosarchaeum
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosarchaeum_sp">Nitrosarchaeum
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilaceae_archaeon">Nitrosopumilaceae
                                                                        archaeon
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_adriaticus">Nitrosopumilus
                                                                        adriaticus
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_cobalaminigenes">Nitrosopumilus
                                                                        cobalaminigenes
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_maritimus">Nitrosopumilus
                                                                        maritimus
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_oxyclinae">Nitrosopumilus
                                                                        oxyclinae
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_piranensis">Nitrosopumilus
                                                                        piranensis
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrosopumilus_sp">Nitrosopumilus
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_ureiphilus">Nitrosopumilus
                                                                        ureiphilus
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosopumilus_zosterae">Nitrosopumilus
                                                                        zosterae
                                                                    </option>
                                                                    <option value="Nitrososphaera_sp">Nitrososphaera
                                                                        sp
                                                                    </option>
                                                                    <option value="Nitrososphaera_sp">Nitrososphaera
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Nitrososphaera_viennensis">Nitrososphaera
                                                                        viennensis
                                                                    </option>
                                                                    <option
                                                                        value="Nitrosotalea_devaniterrae">Nitrosotalea
                                                                        devaniterrae
                                                                    </option>
                                                                    <option value="Nitrosotalea_sinensis">Nitrosotalea
                                                                        sinensis
                                                                    </option>
                                                                    <option value="Oxyplasma_meridianum">Oxyplasma
                                                                        meridianum
                                                                    </option>
                                                                    <option
                                                                        value="Palaeococcus_ferrophilus">Palaeococcus
                                                                        ferrophilus
                                                                    </option>
                                                                    <option value="Palaeococcus_pacificus">Palaeococcus
                                                                        pacificus
                                                                    </option>
                                                                    <option value="Palaeococcus_sp">Palaeococcus sp
                                                                    </option>
                                                                    <option value="Picrophilus_oshimae">Picrophilus
                                                                        oshimae
                                                                    </option>
                                                                    <option value="Poseidonia_sp">Poseidonia sp</option>
                                                                    <option
                                                                        value="Promethearchaeum_syntrophicum">Promethearchaeum
                                                                        syntrophicum
                                                                    </option>
                                                                    <option value="Pyrobaculum_aerophilum">Pyrobaculum
                                                                        aerophilum
                                                                    </option>
                                                                    <option value="Pyrobaculum_arsenaticum">Pyrobaculum
                                                                        arsenaticum
                                                                    </option>
                                                                    <option value="Pyrobaculum_calidifontis">Pyrobaculum
                                                                        calidifontis
                                                                    </option>
                                                                    <option
                                                                        value="Pyrobaculum_ferrireducens">Pyrobaculum
                                                                        ferrireducens
                                                                    </option>
                                                                    <option value="Pyrobaculum_islandicum">Pyrobaculum
                                                                        islandicum
                                                                    </option>
                                                                    <option value="Pyrobaculum_neutrophilum">Pyrobaculum
                                                                        neutrophilum
                                                                    </option>
                                                                    <option value="Pyrobaculum_oguniense">Pyrobaculum
                                                                        oguniense
                                                                    </option>
                                                                    <option value="Pyrobaculum_sp">Pyrobaculum sp
                                                                    </option>
                                                                    <option value="Pyrobaculum_sp">Pyrobaculum sp
                                                                    </option>
                                                                    <option value="Pyrococcus_abyssi">Pyrococcus
                                                                        abyssi
                                                                    </option>
                                                                    <option value="Pyrococcus_furiosus">Pyrococcus
                                                                        furiosus
                                                                    </option>
                                                                    <option value="Pyrococcus_horikoshii">Pyrococcus
                                                                        horikoshii
                                                                    </option>
                                                                    <option value="Pyrococcus_kukulkanii">Pyrococcus
                                                                        kukulkanii
                                                                    </option>
                                                                    <option value="Pyrococcus_sp">Pyrococcus sp</option>
                                                                    <option value="Pyrococcus_sp">Pyrococcus sp</option>
                                                                    <option value="Pyrococcus_sp">Pyrococcus sp</option>
                                                                    <option value="Pyrococcus_yayanosii">Pyrococcus
                                                                        yayanosii
                                                                    </option>
                                                                    <option value="Pyrodictium_abyssi">Pyrodictium
                                                                        abyssi
                                                                    </option>
                                                                    <option value="Pyrodictium_delaneyi">Pyrodictium
                                                                        delaneyi
                                                                    </option>
                                                                    <option value="Pyrodictium_occultum">Pyrodictium
                                                                        occultum
                                                                    </option>
                                                                    <option value="Pyrofollis_japonicus">Pyrofollis
                                                                        japonicus
                                                                    </option>
                                                                    <option value="Pyrolobus_fumarii">Pyrolobus
                                                                        fumarii
                                                                    </option>
                                                                    <option
                                                                        value="Saccharolobus_caldissimus">Saccharolobus
                                                                        caldissimus
                                                                    </option>
                                                                    <option
                                                                        value="Saccharolobus_islandicus">Saccharolobus
                                                                        islandicus
                                                                    </option>
                                                                    <option value="Saccharolobus_shibatae">Saccharolobus
                                                                        shibatae
                                                                    </option>
                                                                    <option
                                                                        value="Saccharolobus_solfataricus">Saccharolobus
                                                                        solfataricus
                                                                    </option>
                                                                    <option value="Saccharolobus_sp">Saccharolobus sp
                                                                    </option>
                                                                    <option value="Saccharolobus_sp">Saccharolobus sp
                                                                    </option>
                                                                    <option value="Saccharolobus_sp">Saccharolobus sp
                                                                    </option>
                                                                    <option value="Salarchaeum_japonicum">Salarchaeum
                                                                        japonicum
                                                                    </option>
                                                                    <option value="Salarchaeum_sp">Salarchaeum sp
                                                                    </option>
                                                                    <option value="Salarchaeum_sp">Salarchaeum sp
                                                                    </option>
                                                                    <option
                                                                        value="Salinadaptatus_halalkaliphilus">Salinadaptatus
                                                                        halalkaliphilus
                                                                    </option>
                                                                    <option
                                                                        value="Salinarchaeum_laminariae">Salinarchaeum
                                                                        laminariae
                                                                    </option>
                                                                    <option value="Salinarchaeum_sp">Salinarchaeum sp
                                                                    </option>
                                                                    <option value="Salinarchaeum_sp">Salinarchaeum sp
                                                                    </option>
                                                                    <option value="Salinibaculum_litoreum">Salinibaculum
                                                                        litoreum
                                                                    </option>
                                                                    <option value="Salinibaculum_sp">Salinibaculum sp
                                                                    </option>
                                                                    <option value="Salinibaculum_sp">Salinibaculum sp
                                                                    </option>
                                                                    <option value="Salinibaculum_sp">Salinibaculum sp
                                                                    </option>
                                                                    <option value="Salinibaculum_sp">Salinibaculum sp
                                                                    </option>
                                                                    <option value="Salinigranum_halophilum">Salinigranum
                                                                        halophilum
                                                                    </option>
                                                                    <option value="Salinigranum_marinum">Salinigranum
                                                                        marinum
                                                                    </option>
                                                                    <option value="Salinigranum_rubrum">Salinigranum
                                                                        rubrum
                                                                    </option>
                                                                    <option value="Salinigranum_salinum">Salinigranum
                                                                        salinum
                                                                    </option>
                                                                    <option value="Salinigranum_sp">Salinigranum sp
                                                                    </option>
                                                                    <option value="Salinigranum_sp">Salinigranum sp
                                                                    </option>
                                                                    <option
                                                                        value="Salinilacihabitans_rarus">Salinilacihabitans
                                                                        rarus
                                                                    </option>
                                                                    <option
                                                                        value="Salinirubellus_salinus">Salinirubellus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Salinirubellus_sp">Salinirubellus
                                                                        sp
                                                                    </option>
                                                                    <option value="Salinirubellus_sp">Salinirubellus
                                                                        sp
                                                                    </option>
                                                                    <option value="Salinirubellus_sp">Salinirubellus
                                                                        sp
                                                                    </option>
                                                                    <option value="Salinirubrum_litoreum">Salinirubrum
                                                                        litoreum
                                                                    </option>
                                                                    <option value="Salinirussus_salinus">Salinirussus
                                                                        salinus
                                                                    </option>
                                                                    <option value="Saliphagus_infecundisoli">Saliphagus
                                                                        infecundisoli
                                                                    </option>
                                                                    <option value="Saliphagus_sp">Saliphagus sp</option>
                                                                    <option
                                                                        value="Staphylothermus_hellenicus">Staphylothermus
                                                                        hellenicus
                                                                    </option>
                                                                    <option
                                                                        value="Staphylothermus_marinus">Staphylothermus
                                                                        marinus
                                                                    </option>
                                                                    <option value="Stygiolobus_azoricus">Stygiolobus
                                                                        azoricus
                                                                    </option>
                                                                    <option value="Stygiolobus_caldivivus">Stygiolobus
                                                                        caldivivus
                                                                    </option>
                                                                    <option value="Stygiolobus_sp">Stygiolobus sp
                                                                    </option>
                                                                    <option value="Stygiolobus_sp">Stygiolobus sp
                                                                    </option>
                                                                    <option value="Stygiolobus_sp">Stygiolobus sp
                                                                    </option>
                                                                    <option value="Stygiolobus_sp">Stygiolobus sp
                                                                    </option>
                                                                    <option
                                                                        value="Sulfodiicoccus_acidiphilus">Sulfodiicoccus
                                                                        acidiphilus
                                                                    </option>
                                                                    <option
                                                                        value="Sulfolobales_archaeon_Acd">Sulfolobales
                                                                        archaeon Acd
                                                                    </option>
                                                                    <option value="Sulfolobus_acidocaldarius">Sulfolobus
                                                                        acidocaldarius
                                                                    </option>
                                                                    <option value="Sulfolobus_sp">Sulfolobus sp</option>
                                                                    <option value="Sulfolobus_sp">Sulfolobus sp</option>
                                                                    <option value="Sulfolobus_sp">Sulfolobus sp</option>
                                                                    <option value="Sulfolobus_tengchongensis">Sulfolobus
                                                                        tengchongensis
                                                                    </option>
                                                                    <option
                                                                        value="Sulfuracidifex_metallicus">Sulfuracidifex
                                                                        metallicus
                                                                    </option>
                                                                    <option
                                                                        value="Sulfuracidifex_tepidarius">Sulfuracidifex
                                                                        tepidarius
                                                                    </option>
                                                                    <option
                                                                        value="Sulfurisphaera_javensis">Sulfurisphaera
                                                                        javensis
                                                                    </option>
                                                                    <option
                                                                        value="Sulfurisphaera_ohwakuensis">Sulfurisphaera
                                                                        ohwakuensis
                                                                    </option>
                                                                    <option
                                                                        value="Sulfurisphaera_tokodaii">Sulfurisphaera
                                                                        tokodaii
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_JGI_OTU">Thaumarchaeota
                                                                        archaeon JGI OTU
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_JGI_OTU">Thaumarchaeota
                                                                        archaeon JGI OTU
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_SCGC_AAA">Thaumarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_SCGC_AAA">Thaumarchaeota
                                                                        archaeon SCGC AAA
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_SCGC_AB">Thaumarchaeota
                                                                        archaeon SCGC AB
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_SCGC_AB">Thaumarchaeota
                                                                        archaeon SCGC AB
                                                                    </option>
                                                                    <option
                                                                        value="Thaumarchaeota_archaeon_SCGC_AC">Thaumarchaeota
                                                                        archaeon SCGC AC
                                                                    </option>
                                                                    <option
                                                                        value="Thermocladium_modestius">Thermocladium
                                                                        modestius
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_aciditolerans">Thermococcus
                                                                        aciditolerans
                                                                    </option>
                                                                    <option value="Thermococcus_aggregans">Thermococcus
                                                                        aggregans
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_alcaliphilus">Thermococcus
                                                                        alcaliphilus
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_argininiproducens">Thermococcus
                                                                        argininiproducens
                                                                    </option>
                                                                    <option value="Thermococcus_barophilus">Thermococcus
                                                                        barophilus
                                                                    </option>
                                                                    <option value="Thermococcus_barossii">Thermococcus
                                                                        barossii
                                                                    </option>
                                                                    <option value="Thermococcus_bergensis">Thermococcus
                                                                        bergensis
                                                                    </option>
                                                                    <option value="Thermococcus_camini">Thermococcus
                                                                        camini
                                                                    </option>
                                                                    <option value="Thermococcus_celer">Thermococcus
                                                                        celer
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_celericrescens">Thermococcus
                                                                        celericrescens
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_chitonophagus">Thermococcus
                                                                        chitonophagus
                                                                    </option>
                                                                    <option value="Thermococcus_cleftensis">Thermococcus
                                                                        cleftensis
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_eurythermalis">Thermococcus
                                                                        eurythermalis
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_gammatolerans">Thermococcus
                                                                        gammatolerans
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_gorgonarius">Thermococcus
                                                                        gorgonarius
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_guaymasensis">Thermococcus
                                                                        guaymasensis
                                                                    </option>
                                                                    <option value="Thermococcus_henrietii">Thermococcus
                                                                        henrietii
                                                                    </option>
                                                                    <option value="Thermococcus_indicus">Thermococcus
                                                                        indicus
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_kodakarensis">Thermococcus
                                                                        kodakarensis
                                                                    </option>
                                                                    <option value="Thermococcus_litoralis">Thermococcus
                                                                        litoralis
                                                                    </option>
                                                                    <option value="Thermococcus_nautili">Thermococcus
                                                                        nautili
                                                                    </option>
                                                                    <option value="Thermococcus_onnurineus">Thermococcus
                                                                        onnurineus
                                                                    </option>
                                                                    <option value="Thermococcus_pacificus">Thermococcus
                                                                        pacificus
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_paralvinellae">Thermococcus
                                                                        paralvinellae
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_peptonophilus">Thermococcus
                                                                        peptonophilus
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_piezophilus">Thermococcus
                                                                        piezophilus
                                                                    </option>
                                                                    <option value="Thermococcus_profundus">Thermococcus
                                                                        profundus
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_radiotolerans">Thermococcus
                                                                        radiotolerans
                                                                    </option>
                                                                    <option value="Thermococcus_sibiricus">Thermococcus
                                                                        sibiricus
                                                                    </option>
                                                                    <option value="Thermococcus_siculi">Thermococcus
                                                                        siculi
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_sp">Thermococcus sp
                                                                    </option>
                                                                    <option value="Thermococcus_stetteri">Thermococcus
                                                                        stetteri
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_thermotolerans">Thermococcus
                                                                        thermotolerans
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_thioreducens">Thermococcus
                                                                        thioreducens
                                                                    </option>
                                                                    <option
                                                                        value="Thermococcus_waiotapuensis">Thermococcus
                                                                        waiotapuensis
                                                                    </option>
                                                                    <option value="Thermococcus_zilligii">Thermococcus
                                                                        zilligii
                                                                    </option>
                                                                    <option value="Thermofilum_adornatum">Thermofilum
                                                                        adornatum
                                                                    </option>
                                                                    <option value="Thermofilum_pendens">Thermofilum
                                                                        pendens
                                                                    </option>
                                                                    <option value="Thermofilum_sp">Thermofilum sp
                                                                    </option>
                                                                    <option value="Thermogladius_calderae">Thermogladius
                                                                        calderae
                                                                    </option>
                                                                    <option
                                                                        value="Thermogymnomonas_acidicola">Thermogymnomonas
                                                                        acidicola
                                                                    </option>
                                                                    <option
                                                                        value="Thermoplasma_acidophilum">Thermoplasma
                                                                        acidophilum
                                                                    </option>
                                                                    <option value="Thermoplasma_sp">Thermoplasma sp
                                                                    </option>
                                                                    <option value="Thermoplasma_sp">Thermoplasma sp
                                                                    </option>
                                                                    <option value="Thermoplasma_volcanium">Thermoplasma
                                                                        volcanium
                                                                    </option>
                                                                    <option
                                                                        value="Thermoplasmatales_archaeon_A">Thermoplasmatales
                                                                        archaeon A
                                                                    </option>
                                                                    <option
                                                                        value="Thermoplasmatales_archaeon_BRNA">Thermoplasmatales
                                                                        archaeon BRNA
                                                                    </option>
                                                                    <option
                                                                        value="Thermoplasmatales_archaeon_SCGC_AB">Thermoplasmatales
                                                                        archaeon SCGC AB
                                                                    </option>
                                                                    <option
                                                                        value="Thermoplasmatales_archaeon_SCGC_AB">Thermoplasmatales
                                                                        archaeon SCGC AB
                                                                    </option>
                                                                    <option
                                                                        value="Thermoplasmatales_archaeon_SCGC_AB">Thermoplasmatales
                                                                        archaeon SCGC AB
                                                                    </option>
                                                                    <option value="Thermoproteus_sp">Thermoproteus sp
                                                                    </option>
                                                                    <option value="Thermoproteus_sp">Thermoproteus sp
                                                                    </option>
                                                                    <option value="Thermoproteus_tenax">Thermoproteus
                                                                        tenax
                                                                    </option>
                                                                    <option
                                                                        value="Thermoproteus_uzoniensis">Thermoproteus
                                                                        uzoniensis
                                                                    </option>
                                                                    <option
                                                                        value="Thermosphaera_aggregans">Thermosphaera
                                                                        aggregans
                                                                    </option>
                                                                    <option value="Thermosphaera_sp">Thermosphaera sp
                                                                    </option>
                                                                    <option value="Vulcanisaeta_distributa">Vulcanisaeta
                                                                        distributa
                                                                    </option>
                                                                    <option
                                                                        value="Vulcanisaeta_moutnovskia">Vulcanisaeta
                                                                        moutnovskia
                                                                    </option>
                                                                    <option value="Vulcanisaeta_souniana">Vulcanisaeta
                                                                        souniana
                                                                    </option>
                                                                    <option value="Vulcanisaeta_sp">Vulcanisaeta sp
                                                                    </option>
                                                                    <option value="Vulcanisaeta_sp">Vulcanisaeta sp
                                                                    </option>
                                                                    <option value="Vulcanisaeta_sp">Vulcanisaeta sp
                                                                    </option>
                                                                    <option value="Vulcanisaeta_sp">Vulcanisaeta sp
                                                                    </option>
                                                                    <option
                                                                        value="Vulcanisaeta_thermophila">Vulcanisaeta
                                                                        thermophila
                                                                    </option>
                                                                    <option value="archaeon">archaeon</option>
                                                                    <option value="crenarchaeote_JGI">crenarchaeote
                                                                        JGI
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="crenarchaeote_SCGC_AAA">crenarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="euryarchaeote_SCGC_AAA">euryarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="euryarchaeote_SCGC_AAA">euryarchaeote
                                                                        SCGC AAA
                                                                    </option>
                                                                    <option value="haloarchaeon_">haloarchaeon</option>
                                                                    <option value="halophilic_archaeon">halophilic
                                                                        archaeon
                                                                    </option>
                                                                    <option value="halophilic_archaeon_DL">halophilic
                                                                        archaeon DL
                                                                    </option>
                                                                    <option value="halophilic_archaeon_J">halophilic
                                                                        archaeon J
                                                                    </option>
                                                                    <option value="halophilic_archaeon_J">halophilic
                                                                        archaeon J
                                                                    </option>
                                                                    <option value="halophilic_archaeon_J">halophilic
                                                                        archaeon J
                                                                    </option>
                                                                    <option value="halophilic_archaeon_SHRA">halophilic
                                                                        archaeon SHRA
                                                                    </option>
                                                                    <option value="methanogenic_archaeon">methanogenic
                                                                        archaeon
                                                                    </option>
                                                                    <option
                                                                        value="methanogenic_archaeon_ISO">methanogenic
                                                                        archaeon ISO
                                                                    </option>
                                                                    <option value="uncultured_Acidilobus_sp">uncultured
                                                                        Acidilobus sp
                                                                    </option>
                                                                    <option value="uncultured_Acidilobus_sp">uncultured
                                                                        Acidilobus sp
                                                                    </option>
                                                                    <option value="uncultured_Acidilobus_sp">uncultured
                                                                        Acidilobus sp
                                                                    </option>
                                                                    <option value="uncultured_Acidilobus_sp">uncultured
                                                                        Acidilobus sp
                                                                    </option>
                                                                    <option value="uncultured_Halorubrum_sp">uncultured
                                                                        Halorubrum sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanobacterium_sp">uncultured
                                                                        Methanobacterium sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanobrevibacter_sp">uncultured
                                                                        Methanobrevibacter sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanocorpusculum_sp">uncultured
                                                                        Methanocorpusculum sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanoculleus_sp">uncultured
                                                                        Methanoculleus sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanofollis_sp">uncultured
                                                                        Methanofollis sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanolobus_sp">uncultured
                                                                        Methanolobus sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanomethylovorans_sp">uncultured
                                                                        Methanomethylovorans sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanoregula_sp">uncultured
                                                                        Methanoregula sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanosphaera_sp">uncultured
                                                                        Methanosphaera sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Methanospirillum_sp">uncultured
                                                                        Methanospirillum sp
                                                                    </option>
                                                                    <option
                                                                        value="uncultured_Nitrososphaera_sp">uncultured
                                                                        Nitrososphaera sp
                                                                    </option>
                                                                    <option value="uncultured_archaeon_A">uncultured
                                                                        archaeon A
                                                                    </option>
                                                                    <option value="uncultured_archaeon_A">uncultured
                                                                        archaeon A
                                                                    </option>
                                                                    <option value="uncultured_archaeon_A">uncultured
                                                                        archaeon A
                                                                    </option>
                                                                    <option value="uncultured_archaeon_A">uncultured
                                                                        archaeon A
                                                                    </option>
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "bacteria" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    {/* Fill with invertebrate species */}
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "fungi" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option value="Aaosphaeria_arxii">Aaosphaeria
                                                                        arxii
                                                                    </option>
                                                                    <option value="Acaromyces_ingoldii">Acaromyces
                                                                        ingoldii
                                                                    </option>
                                                                    <option value="Agaricus_bisporus">Agaricus
                                                                        bisporus
                                                                    </option>
                                                                    <option value="Akanthomyces_muscarius">Akanthomyces
                                                                        muscarius
                                                                    </option>
                                                                    <option value="Alternaria_alternata">Alternaria
                                                                        alternata
                                                                    </option>
                                                                    <option value="Alternaria_arborescens">Alternaria
                                                                        arborescens
                                                                    </option>
                                                                    <option value="Alternaria_arbusti">Alternaria
                                                                        arbusti
                                                                    </option>
                                                                    <option value="Alternaria_atra">Alternaria atra
                                                                    </option>
                                                                    <option value="Alternaria_burnsii">Alternaria
                                                                        burnsii
                                                                    </option>
                                                                    <option value="Alternaria_conjuncta">Alternaria
                                                                        conjuncta
                                                                    </option>
                                                                    <option value="Alternaria_dauci">Alternaria dauci
                                                                    </option>
                                                                    <option value="Alternaria_ethzedia">Alternaria
                                                                        ethzedia
                                                                    </option>
                                                                    <option
                                                                        value="Alternaria_hordeiaustralica">Alternaria
                                                                        hordeiaustralica
                                                                    </option>
                                                                    <option value="Alternaria_incomplexa">Alternaria
                                                                        incomplexa
                                                                    </option>
                                                                    <option value="Alternaria_infectoria">Alternaria
                                                                        infectoria
                                                                    </option>
                                                                    <option value="Alternaria_metachromatica">Alternaria
                                                                        metachromatica
                                                                    </option>
                                                                    <option value="Alternaria_novae">Alternaria novae
                                                                    </option>
                                                                    <option value="Alternaria_postmessia">Alternaria
                                                                        postmessia
                                                                    </option>
                                                                    <option value="Alternaria_rosae">Alternaria rosae
                                                                    </option>
                                                                    <option
                                                                        value="Alternaria_triticimaculans">Alternaria
                                                                        triticimaculans
                                                                    </option>
                                                                    <option value="Alternaria_ventricosa">Alternaria
                                                                        ventricosa
                                                                    </option>
                                                                    <option value="Alternaria_viburni">Alternaria
                                                                        viburni
                                                                    </option>
                                                                    <option value="Amorphotheca_resinae">Amorphotheca
                                                                        resinae
                                                                    </option>
                                                                    <option
                                                                        value="Annulohypoxylon_maeteangense">Annulohypoxylon
                                                                        maeteangense
                                                                    </option>
                                                                    <option
                                                                        value="Annulohypoxylon_truncatum">Annulohypoxylon
                                                                        truncatum
                                                                    </option>
                                                                    <option value="Apiospora_aurea">Apiospora aurea
                                                                    </option>
                                                                    <option value="Apiospora_hydei">Apiospora hydei
                                                                    </option>
                                                                    <option value="Apiospora_kogelbergensis">Apiospora
                                                                        kogelbergensis
                                                                    </option>
                                                                    <option value="Apiospora_marii">Apiospora marii
                                                                    </option>
                                                                    <option value="Apiospora_phragmitis">Apiospora
                                                                        phragmitis
                                                                    </option>
                                                                    <option value="Apiotrichum_porosum">Apiotrichum
                                                                        porosum
                                                                    </option>
                                                                    <option value="Aplosporella_prunicola">Aplosporella
                                                                        prunicola
                                                                    </option>
                                                                    <option value="Arthrobotrys_flagrans">Arthrobotrys
                                                                        flagrans
                                                                    </option>
                                                                    <option value="Arthroderma_uncinatum">Arthroderma
                                                                        uncinatum
                                                                    </option>
                                                                    <option value="Arxiozyma_heterogenica">Arxiozyma
                                                                        heterogenica
                                                                    </option>
                                                                    <option value="Ascochyta_rabiei">Ascochyta rabiei
                                                                    </option>
                                                                    <option value="Ascoidea_rubescens">Ascoidea
                                                                        rubescens
                                                                    </option>
                                                                    <option value="Aspergillus_aculeatinus">Aspergillus
                                                                        aculeatinus
                                                                    </option>
                                                                    <option value="Aspergillus_aculeatus">Aspergillus
                                                                        aculeatus
                                                                    </option>
                                                                    <option value="Aspergillus_affinis">Aspergillus
                                                                        affinis
                                                                    </option>
                                                                    <option value="Aspergillus_alliaceus">Aspergillus
                                                                        alliaceus
                                                                    </option>
                                                                    <option value="Aspergillus_bombycis">Aspergillus
                                                                        bombycis
                                                                    </option>
                                                                    <option value="Aspergillus_brasiliensis">Aspergillus
                                                                        brasiliensis
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_brunneoviolaceus">Aspergillus
                                                                        brunneoviolaceus
                                                                    </option>
                                                                    <option value="Aspergillus_caelatus">Aspergillus
                                                                        caelatus
                                                                    </option>
                                                                    <option value="Aspergillus_campestris">Aspergillus
                                                                        campestris
                                                                    </option>
                                                                    <option value="Aspergillus_candidus">Aspergillus
                                                                        candidus
                                                                    </option>
                                                                    <option value="Aspergillus_chevalieri">Aspergillus
                                                                        chevalieri
                                                                    </option>
                                                                    <option value="Aspergillus_clavatus">Aspergillus
                                                                        clavatus
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_costaricensis">Aspergillus
                                                                        costaricensis
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_eucalypticola">Aspergillus
                                                                        eucalypticola
                                                                    </option>
                                                                    <option value="Aspergillus_fijiensis">Aspergillus
                                                                        fijiensis
                                                                    </option>
                                                                    <option value="Aspergillus_fischeri">Aspergillus
                                                                        fischeri
                                                                    </option>
                                                                    <option value="Aspergillus_flavus">Aspergillus
                                                                        flavus
                                                                    </option>
                                                                    <option value="Aspergillus_fumigatus">Aspergillus
                                                                        fumigatus
                                                                    </option>
                                                                    <option value="Aspergillus_glaucus">Aspergillus
                                                                        glaucus
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_heteromorphus">Aspergillus
                                                                        heteromorphus
                                                                    </option>
                                                                    <option value="Aspergillus_homomorphus">Aspergillus
                                                                        homomorphus
                                                                    </option>
                                                                    <option value="Aspergillus_ibericus">Aspergillus
                                                                        ibericus
                                                                    </option>
                                                                    <option value="Aspergillus_japonicus">Aspergillus
                                                                        japonicus
                                                                    </option>
                                                                    <option value="Aspergillus_lentulus">Aspergillus
                                                                        lentulus
                                                                    </option>
                                                                    <option value="Aspergillus_luchuensis">Aspergillus
                                                                        luchuensis
                                                                    </option>
                                                                    <option value="Aspergillus_lucknowensis">Aspergillus
                                                                        lucknowensis
                                                                    </option>
                                                                    <option value="Aspergillus_melleus">Aspergillus
                                                                        melleus
                                                                    </option>
                                                                    <option value="Aspergillus_mulundensis">Aspergillus
                                                                        mulundensis
                                                                    </option>
                                                                    <option value="Aspergillus_neoniger">Aspergillus
                                                                        neoniger
                                                                    </option>
                                                                    <option value="Aspergillus_nidulans">Aspergillus
                                                                        nidulans
                                                                    </option>
                                                                    <option value="Aspergillus_niger">Aspergillus
                                                                        niger
                                                                    </option>
                                                                    <option value="Aspergillus_nomiae">Aspergillus
                                                                        nomiae
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_novofumigatus">Aspergillus
                                                                        novofumigatus
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_ochraceoroseus">Aspergillus
                                                                        ochraceoroseus
                                                                    </option>
                                                                    <option value="Aspergillus_oryzae">Aspergillus
                                                                        oryzae
                                                                    </option>
                                                                    <option value="Aspergillus_piperis">Aspergillus
                                                                        piperis
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_pseudodeflectus">Aspergillus
                                                                        pseudodeflectus
                                                                    </option>
                                                                    <option value="Aspergillus_pseudonomiae">Aspergillus
                                                                        pseudonomiae
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_pseudotamarii">Aspergillus
                                                                        pseudotamarii
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_pseudoviridinutans">Aspergillus
                                                                        pseudoviridinutans
                                                                    </option>
                                                                    <option value="Aspergillus_puulaauensis">Aspergillus
                                                                        puulaauensis
                                                                    </option>
                                                                    <option value="Aspergillus_ruber">Aspergillus
                                                                        ruber
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_saccharolyticus">Aspergillus
                                                                        saccharolyticus
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_sclerotioniger">Aspergillus
                                                                        sclerotioniger
                                                                    </option>
                                                                    <option value="Aspergillus_steynii">Aspergillus
                                                                        steynii
                                                                    </option>
                                                                    <option value="Aspergillus_sydowii">Aspergillus
                                                                        sydowii
                                                                    </option>
                                                                    <option value="Aspergillus_tanneri">Aspergillus
                                                                        tanneri
                                                                    </option>
                                                                    <option value="Aspergillus_terreus">Aspergillus
                                                                        terreus
                                                                    </option>
                                                                    <option
                                                                        value="Aspergillus_thermomutatus">Aspergillus
                                                                        thermomutatus
                                                                    </option>
                                                                    <option value="Aspergillus_tubingensis">Aspergillus
                                                                        tubingensis
                                                                    </option>
                                                                    <option value="Aspergillus_udagawae">Aspergillus
                                                                        udagawae
                                                                    </option>
                                                                    <option value="Aspergillus_uvarum">Aspergillus
                                                                        uvarum
                                                                    </option>
                                                                    <option value="Aspergillus_vadensis">Aspergillus
                                                                        vadensis
                                                                    </option>
                                                                    <option value="Aspergillus_versicolor">Aspergillus
                                                                        versicolor
                                                                    </option>
                                                                    <option value="Aspergillus_viridinutans">Aspergillus
                                                                        viridinutans
                                                                    </option>
                                                                    <option value="Aspergillus_welwitschiae">Aspergillus
                                                                        welwitschiae
                                                                    </option>
                                                                    <option value="Aspergillus_wentii">Aspergillus
                                                                        wentii
                                                                    </option>
                                                                    <option
                                                                        value="Aureobasidium_melanogenum">Aureobasidium
                                                                        melanogenum
                                                                    </option>
                                                                    <option value="Aureobasidium_namibiae">Aureobasidium
                                                                        namibiae
                                                                    </option>
                                                                    <option
                                                                        value="Aureobasidium_pullulans">Aureobasidium
                                                                        pullulans
                                                                    </option>
                                                                    <option
                                                                        value="Aureobasidium_subglaciale">Aureobasidium
                                                                        subglaciale
                                                                    </option>
                                                                    <option value="Auricularia_subglabra">Auricularia
                                                                        subglabra
                                                                    </option>
                                                                    <option
                                                                        value="Australozyma_saopauloensis">Australozyma
                                                                        saopauloensis
                                                                    </option>
                                                                    <option value="Babjeviella_inositovora">Babjeviella
                                                                        inositovora
                                                                    </option>
                                                                    <option value="Bacidia_gigantensis">Bacidia
                                                                        gigantensis
                                                                    </option>
                                                                    <option
                                                                        value="Batrachochytrium_dendrobatidis">Batrachochytrium
                                                                        dendrobatidis
                                                                    </option>
                                                                    <option value="Baudoinia_panamericana">Baudoinia
                                                                        panamericana
                                                                    </option>
                                                                    <option value="Beauveria_bassiana">Beauveria
                                                                        bassiana
                                                                    </option>
                                                                    <option value="Bipolaris_maydis">Bipolaris maydis
                                                                    </option>
                                                                    <option value="Bipolaris_oryzae">Bipolaris oryzae
                                                                    </option>
                                                                    <option value="Bipolaris_sorokiniana">Bipolaris
                                                                        sorokiniana
                                                                    </option>
                                                                    <option value="Bipolaris_victoriae">Bipolaris
                                                                        victoriae
                                                                    </option>
                                                                    <option value="Bipolaris_zeicola">Bipolaris
                                                                        zeicola
                                                                    </option>
                                                                    <option value="Blastomyces_dermatitidis">Blastomyces
                                                                        dermatitidis
                                                                    </option>
                                                                    <option value="Blastomyces_gilchristii">Blastomyces
                                                                        gilchristii
                                                                    </option>
                                                                    <option value="Boeremia_exigua">Boeremia exigua
                                                                    </option>
                                                                    <option value="Botrytis_byssoidea">Botrytis
                                                                        byssoidea
                                                                    </option>
                                                                    <option value="Botrytis_cinerea">Botrytis cinerea
                                                                    </option>
                                                                    <option value="Botrytis_deweyae">Botrytis deweyae
                                                                    </option>
                                                                    <option value="Botrytis_fragariae">Botrytis
                                                                        fragariae
                                                                    </option>
                                                                    <option value="Botrytis_porri">Botrytis porri
                                                                    </option>
                                                                    <option value="Botrytis_sinoallii">Botrytis
                                                                        sinoallii
                                                                    </option>
                                                                    <option
                                                                        value="Brettanomyces_bruxellensis">Brettanomyces
                                                                        bruxellensis
                                                                    </option>
                                                                    <option value="Brettanomyces_nanus">Brettanomyces
                                                                        nanus
                                                                    </option>
                                                                    <option value="Cadophora_gregata">Cadophora
                                                                        gregata
                                                                    </option>
                                                                    <option
                                                                        value="Calcarisporiella_thermophila">Calcarisporiella
                                                                        thermophila
                                                                    </option>
                                                                    <option value="Canariomyces_notabilis">Canariomyces
                                                                        notabilis
                                                                    </option>
                                                                    <option value="Candida_albicans">Candida albicans
                                                                    </option>
                                                                    <option value="Candida_dubliniensis">Candida
                                                                        dubliniensis
                                                                    </option>
                                                                    <option value="Candida_jiufengensis">Candida
                                                                        jiufengensis
                                                                    </option>
                                                                    <option value="Candida_margitis">Candida margitis
                                                                    </option>
                                                                    <option value="Candida_metapsilosis">Candida
                                                                        metapsilosis
                                                                    </option>
                                                                    <option value="Candida_orthopsilosis">Candida
                                                                        orthopsilosis
                                                                    </option>
                                                                    <option value="Candida_oxycetoniae">Candida
                                                                        oxycetoniae
                                                                    </option>
                                                                    <option value="Candida_parapsilosis">Candida
                                                                        parapsilosis
                                                                    </option>
                                                                    <option value="Candida_pseudojiufengensis">Candida
                                                                        pseudojiufengensis
                                                                    </option>
                                                                    <option value="Candida_theae">Candida theae</option>
                                                                    <option value="Candida_tropicalis">Candida
                                                                        tropicalis
                                                                    </option>
                                                                    <option value="Candida_viswanathii">Candida
                                                                        viswanathii
                                                                    </option>
                                                                    <option value="Candidozyma_auris">Candidozyma
                                                                        auris
                                                                    </option>
                                                                    <option
                                                                        value="Candidozyma_duobushaemuli">Candidozyma
                                                                        duobushaemuli
                                                                    </option>
                                                                    <option value="Candidozyma_haemuli">Candidozyma
                                                                        haemuli
                                                                    </option>
                                                                    <option
                                                                        value="Candidozyma_pseudohaemuli">Candidozyma
                                                                        pseudohaemuli
                                                                    </option>
                                                                    <option value="Cantharellus_anzutake">Cantharellus
                                                                        anzutake
                                                                    </option>
                                                                    <option value="Capronia_coronata">Capronia
                                                                        coronata
                                                                    </option>
                                                                    <option value="Capronia_epimyces">Capronia
                                                                        epimyces
                                                                    </option>
                                                                    <option value="Cenococcum_geophilum">Cenococcum
                                                                        geophilum
                                                                    </option>
                                                                    <option value="Ceraceosorus_guamensis">Ceraceosorus
                                                                        guamensis
                                                                    </option>
                                                                    <option value="Ceratocystis_lukuohia">Ceratocystis
                                                                        lukuohia
                                                                    </option>
                                                                    <option value="Cercospora_beticola">Cercospora
                                                                        beticola
                                                                    </option>
                                                                    <option value="Cercospora_kikuchii">Cercospora
                                                                        kikuchii
                                                                    </option>
                                                                    <option value="Chaetomium_fimeti">Chaetomium
                                                                        fimeti
                                                                    </option>
                                                                    <option value="Chaetomium_globosum">Chaetomium
                                                                        globosum
                                                                    </option>
                                                                    <option value="Chaetomium_strumarium">Chaetomium
                                                                        strumarium
                                                                    </option>
                                                                    <option value="Chaetomium_tenue">Chaetomium tenue
                                                                    </option>
                                                                    <option
                                                                        value="Cladophialophora_bantiana">Cladophialophora
                                                                        bantiana
                                                                    </option>
                                                                    <option
                                                                        value="Cladophialophora_carrionii">Cladophialophora
                                                                        carrionii
                                                                    </option>
                                                                    <option
                                                                        value="Cladophialophora_immunda">Cladophialophora
                                                                        immunda
                                                                    </option>
                                                                    <option
                                                                        value="Cladophialophora_psammophila">Cladophialophora
                                                                        psammophila
                                                                    </option>
                                                                    <option
                                                                        value="Cladophialophora_yegresii">Cladophialophora
                                                                        yegresii
                                                                    </option>
                                                                    <option
                                                                        value="Cladosporium_halotolerans">Cladosporium
                                                                        halotolerans
                                                                    </option>
                                                                    <option value="Clavispora_lusitaniae">Clavispora
                                                                        lusitaniae
                                                                    </option>
                                                                    <option value="Coccidioides_immitis">Coccidioides
                                                                        immitis
                                                                    </option>
                                                                    <option value="Coccidioides_posadasii">Coccidioides
                                                                        posadasii
                                                                    </option>
                                                                    <option value="Cokeromyces_recurvatus">Cokeromyces
                                                                        recurvatus
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_abscissum">Colletotrichum
                                                                        abscissum
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_acutatum">Colletotrichum
                                                                        acutatum
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_aenigma">Colletotrichum
                                                                        aenigma
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_chrysophilum">Colletotrichum
                                                                        chrysophilum
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_costaricense">Colletotrichum
                                                                        costaricense
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_destructivum">Colletotrichum
                                                                        destructivum
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_fioriniae">Colletotrichum
                                                                        fioriniae
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_fructicola">Colletotrichum
                                                                        fructicola
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_gloeosporioides">Colletotrichum
                                                                        gloeosporioides
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_godetiae">Colletotrichum
                                                                        godetiae
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_graminicola">Colletotrichum
                                                                        graminicola
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_higginsianum">Colletotrichum
                                                                        higginsianum
                                                                    </option>
                                                                    <option value="Colletotrichum_karsti">Colletotrichum
                                                                        karsti
                                                                    </option>
                                                                    <option value="Colletotrichum_lupini">Colletotrichum
                                                                        lupini
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_navitas">Colletotrichum
                                                                        navitas
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_orchidophilum">Colletotrichum
                                                                        orchidophilum
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_paranaense">Colletotrichum
                                                                        paranaense
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_phormii">Colletotrichum
                                                                        phormii
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_scovillei">Colletotrichum
                                                                        scovillei
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_siamense">Colletotrichum
                                                                        siamense
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_spaethianum">Colletotrichum
                                                                        spaethianum
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_tamarilloi">Colletotrichum
                                                                        tamarilloi
                                                                    </option>
                                                                    <option
                                                                        value="Colletotrichum_truncatum">Colletotrichum
                                                                        truncatum
                                                                    </option>
                                                                    <option value="Coniophora_puteana">Coniophora
                                                                        puteana
                                                                    </option>
                                                                    <option value="Coniosporium_apollinis">Coniosporium
                                                                        apollinis
                                                                    </option>
                                                                    <option value="Coprinopsis_cinerea">Coprinopsis
                                                                        cinerea
                                                                    </option>
                                                                    <option value="Cordyceps_fumosorosea">Cordyceps
                                                                        fumosorosea
                                                                    </option>
                                                                    <option value="Cordyceps_militaris">Cordyceps
                                                                        militaris
                                                                    </option>
                                                                    <option
                                                                        value="Cryphonectria_parasitica">Cryphonectria
                                                                        parasitica
                                                                    </option>
                                                                    <option
                                                                        value="Cryptococcus_amylolentus">Cryptococcus
                                                                        amylolentus
                                                                    </option>
                                                                    <option
                                                                        value="Cryptococcus_bacillisporus">Cryptococcus
                                                                        bacillisporus
                                                                    </option>
                                                                    <option value="Cryptococcus_decagattii">Cryptococcus
                                                                        decagattii
                                                                    </option>
                                                                    <option
                                                                        value="Cryptococcus_depauperatus">Cryptococcus
                                                                        depauperatus
                                                                    </option>
                                                                    <option
                                                                        value="Cryptococcus_deuterogattii">Cryptococcus
                                                                        deuterogattii
                                                                    </option>
                                                                    <option value="Cryptococcus_gattii">Cryptococcus
                                                                        gattii
                                                                    </option>
                                                                    <option value="Cryptococcus_neoformans">Cryptococcus
                                                                        neoformans
                                                                    </option>
                                                                    <option
                                                                        value="Cryptococcus_tetragattii">Cryptococcus
                                                                        tetragattii
                                                                    </option>
                                                                    <option
                                                                        value="Cryptococcus_wingfieldii">Cryptococcus
                                                                        wingfieldii
                                                                    </option>
                                                                    <option value="Cucurbitaria_berberidis">Cucurbitaria
                                                                        berberidis
                                                                    </option>
                                                                    <option
                                                                        value="Cutaneotrichosporon_cavernicola">Cutaneotrichosporon
                                                                        cavernicola
                                                                    </option>
                                                                    <option
                                                                        value="Cutaneotrichosporon_oleaginosum">Cutaneotrichosporon
                                                                        oleaginosum
                                                                    </option>
                                                                    <option value="Cyberlindnera_jadinii">Cyberlindnera
                                                                        jadinii
                                                                    </option>
                                                                    <option
                                                                        value="Cyphellophora_attinorum">Cyphellophora
                                                                        attinorum
                                                                    </option>
                                                                    <option value="Cyphellophora_europaea">Cyphellophora
                                                                        europaea
                                                                    </option>
                                                                    <option value="Cystobasidium_minutum">Cystobasidium
                                                                        minutum
                                                                    </option>
                                                                    <option value="Dacryopinax_primogenitus">Dacryopinax
                                                                        primogenitus
                                                                    </option>
                                                                    <option value="Dactylellina_haptotyla">Dactylellina
                                                                        haptotyla
                                                                    </option>
                                                                    <option value="Daldinia_caldariorum">Daldinia
                                                                        caldariorum
                                                                    </option>
                                                                    <option value="Daldinia_childiae">Daldinia
                                                                        childiae
                                                                    </option>
                                                                    <option value="Daldinia_decipiens">Daldinia
                                                                        decipiens
                                                                    </option>
                                                                    <option value="Daldinia_loculata">Daldinia
                                                                        loculata
                                                                    </option>
                                                                    <option value="Daldinia_vernicosa">Daldinia
                                                                        vernicosa
                                                                    </option>
                                                                    <option value="Debaryomyces_fabryi">Debaryomyces
                                                                        fabryi
                                                                    </option>
                                                                    <option value="Debaryomyces_hansenii">Debaryomyces
                                                                        hansenii
                                                                    </option>
                                                                    <option
                                                                        value="Desarmillaria_tabescens">Desarmillaria
                                                                        tabescens
                                                                    </option>
                                                                    <option value="Diaporthe_amygdali">Diaporthe
                                                                        amygdali
                                                                    </option>
                                                                    <option value="Diaporthe_batatas">Diaporthe
                                                                        batatas
                                                                    </option>
                                                                    <option value="Diaporthe_citri">Diaporthe citri
                                                                    </option>
                                                                    <option value="Dichomitus_squalens">Dichomitus
                                                                        squalens
                                                                    </option>
                                                                    <option
                                                                        value="Dichotomopilus_funicola">Dichotomopilus
                                                                        funicola
                                                                    </option>
                                                                    <option value="Didymella_exigua">Didymella exigua
                                                                    </option>
                                                                    <option
                                                                        value="Didymosphaeria_variabile">Didymosphaeria
                                                                        variabile
                                                                    </option>
                                                                    <option value="Dioszegia_hungarica">Dioszegia
                                                                        hungarica
                                                                    </option>
                                                                    <option value="Diplodia_corticola">Diplodia
                                                                        corticola
                                                                    </option>
                                                                    <option value="Diplodia_seriata">Diplodia seriata
                                                                    </option>
                                                                    <option value="Dipodascopsis_tothii">Dipodascopsis
                                                                        tothii
                                                                    </option>
                                                                    <option value="Dissoconium_aciculare">Dissoconium
                                                                        aciculare
                                                                    </option>
                                                                    <option value="Diutina_rugosa">Diutina rugosa
                                                                    </option>
                                                                    <option
                                                                        value="Dothidotthia_symphoricarpi">Dothidotthia
                                                                        symphoricarpi
                                                                    </option>
                                                                    <option value="Drechmeria_coniospora">Drechmeria
                                                                        coniospora
                                                                    </option>
                                                                    <option value="Drepanopeziza_brunnea">Drepanopeziza
                                                                        brunnea
                                                                    </option>
                                                                    <option value="Durotheca_rogersii">Durotheca
                                                                        rogersii
                                                                    </option>
                                                                    <option
                                                                        value="Emericellopsis_atlantica">Emericellopsis
                                                                        atlantica
                                                                    </option>
                                                                    <option
                                                                        value="Emericellopsis_cladophorae">Emericellopsis
                                                                        cladophorae
                                                                    </option>
                                                                    <option
                                                                        value="Encephalitozoon_cuniculi">Encephalitozoon
                                                                        cuniculi
                                                                    </option>
                                                                    <option
                                                                        value="Encephalitozoon_hellem">Encephalitozoon
                                                                        hellem
                                                                    </option>
                                                                    <option
                                                                        value="Encephalitozoon_intestinalis">Encephalitozoon
                                                                        intestinalis
                                                                    </option>
                                                                    <option
                                                                        value="Encephalitozoon_romaleae">Encephalitozoon
                                                                        romaleae
                                                                    </option>
                                                                    <option value="Endocarpon_pusillum">Endocarpon
                                                                        pusillum
                                                                    </option>
                                                                    <option
                                                                        value="Enterocytozoon_bieneusi">Enterocytozoon
                                                                        bieneusi
                                                                    </option>
                                                                    <option value="Epithele_typhae">Epithele typhae
                                                                    </option>
                                                                    <option value="Eremomyces_bilateralis">Eremomyces
                                                                        bilateralis
                                                                    </option>
                                                                    <option
                                                                        value="Eremothecium_cymbalariae">Eremothecium
                                                                        cymbalariae
                                                                    </option>
                                                                    <option value="Eremothecium_gossypii">Eremothecium
                                                                        gossypii
                                                                    </option>
                                                                    <option value="Eremothecium_sinecaudum">Eremothecium
                                                                        sinecaudum
                                                                    </option>
                                                                    <option value="Eutypa_lata">Eutypa lata</option>
                                                                    <option value="Exophiala_aquamarina">Exophiala
                                                                        aquamarina
                                                                    </option>
                                                                    <option value="Exophiala_bonariae">Exophiala
                                                                        bonariae
                                                                    </option>
                                                                    <option value="Exophiala_dermatitidis">Exophiala
                                                                        dermatitidis
                                                                    </option>
                                                                    <option value="Exophiala_mesophila">Exophiala
                                                                        mesophila
                                                                    </option>
                                                                    <option value="Exophiala_oligosperma">Exophiala
                                                                        oligosperma
                                                                    </option>
                                                                    <option value="Exophiala_spinifera">Exophiala
                                                                        spinifera
                                                                    </option>
                                                                    <option value="Exophiala_viscosa">Exophiala
                                                                        viscosa
                                                                    </option>
                                                                    <option value="Exophiala_xenobiotica">Exophiala
                                                                        xenobiotica
                                                                    </option>
                                                                    <option value="Exserohilum_turcicum">Exserohilum
                                                                        turcicum
                                                                    </option>
                                                                    <option value="Fibroporia_radiculosa">Fibroporia
                                                                        radiculosa
                                                                    </option>
                                                                    <option value="Filobasidium_floriforme">Filobasidium
                                                                        floriforme
                                                                    </option>
                                                                    <option
                                                                        value="Fimicolochytrium_jonesii">Fimicolochytrium
                                                                        jonesii
                                                                    </option>
                                                                    <option value="Fomitiporia_mediterranea">Fomitiporia
                                                                        mediterranea
                                                                    </option>
                                                                    <option value="Fomitopsis_serialis">Fomitopsis
                                                                        serialis
                                                                    </option>
                                                                    <option value="Fonsecaea_erecta">Fonsecaea erecta
                                                                    </option>
                                                                    <option value="Fonsecaea_monophora">Fonsecaea
                                                                        monophora
                                                                    </option>
                                                                    <option value="Fonsecaea_multimorphosa">Fonsecaea
                                                                        multimorphosa
                                                                    </option>
                                                                    <option value="Fonsecaea_nubica">Fonsecaea nubica
                                                                    </option>
                                                                    <option value="Fonsecaea_pedrosoi">Fonsecaea
                                                                        pedrosoi
                                                                    </option>
                                                                    <option value="Fulvia_fulva">Fulvia fulva</option>
                                                                    <option value="Fusarium_coffeatum">Fusarium
                                                                        coffeatum
                                                                    </option>
                                                                    <option value="Fusarium_falciforme">Fusarium
                                                                        falciforme
                                                                    </option>
                                                                    <option value="Fusarium_flagelliforme">Fusarium
                                                                        flagelliforme
                                                                    </option>
                                                                    <option value="Fusarium_fujikuroi">Fusarium
                                                                        fujikuroi
                                                                    </option>
                                                                    <option value="Fusarium_graminearum">Fusarium
                                                                        graminearum
                                                                    </option>
                                                                    <option value="Fusarium_keratoplasticum">Fusarium
                                                                        keratoplasticum
                                                                    </option>
                                                                    <option value="Fusarium_mangiferae">Fusarium
                                                                        mangiferae
                                                                    </option>
                                                                    <option value="Fusarium_musae">Fusarium musae
                                                                    </option>
                                                                    <option value="Fusarium_odoratissimum">Fusarium
                                                                        odoratissimum
                                                                    </option>
                                                                    <option value="Fusarium_oxysporum">Fusarium
                                                                        oxysporum
                                                                    </option>
                                                                    <option value="Fusarium_poae">Fusarium poae</option>
                                                                    <option value="Fusarium_proliferatum">Fusarium
                                                                        proliferatum
                                                                    </option>
                                                                    <option value="Fusarium_pseudograminearum">Fusarium
                                                                        pseudograminearum
                                                                    </option>
                                                                    <option value="Fusarium_redolens">Fusarium
                                                                        redolens
                                                                    </option>
                                                                    <option value="Fusarium_solani">Fusarium solani
                                                                    </option>
                                                                    <option value="Fusarium_subglutinans">Fusarium
                                                                        subglutinans
                                                                    </option>
                                                                    <option value="Fusarium_tjaetaba">Fusarium
                                                                        tjaetaba
                                                                    </option>
                                                                    <option value="Fusarium_vanettenii">Fusarium
                                                                        vanettenii
                                                                    </option>
                                                                    <option value="Fusarium_venenatum">Fusarium
                                                                        venenatum
                                                                    </option>
                                                                    <option value="Fusarium_verticillioides">Fusarium
                                                                        verticillioides
                                                                    </option>
                                                                    <option
                                                                        value="Gaeumannomyces_tritici">Gaeumannomyces
                                                                        tritici
                                                                    </option>
                                                                    <option value="Gamsiella_multidivaricata">Gamsiella
                                                                        multidivaricata
                                                                    </option>
                                                                    <option value="Geosmithia_morbida">Geosmithia
                                                                        morbida
                                                                    </option>
                                                                    <option value="Gilbertella_persicaria">Gilbertella
                                                                        persicaria
                                                                    </option>
                                                                    <option value="Glarea_lozoyensis">Glarea
                                                                        lozoyensis
                                                                    </option>
                                                                    <option value="Gloeophyllum_trabeum">Gloeophyllum
                                                                        trabeum
                                                                    </option>
                                                                    <option
                                                                        value="Guyanagaster_necrorhizus">Guyanagaster
                                                                        necrorhizus
                                                                    </option>
                                                                    <option value="Halteromyces_radiatus">Halteromyces
                                                                        radiatus
                                                                    </option>
                                                                    <option
                                                                        value="Henningerozyma_blattae">Henningerozyma
                                                                        blattae
                                                                    </option>
                                                                    <option
                                                                        value="Heterobasidion_irregulare">Heterobasidion
                                                                        irregulare
                                                                    </option>
                                                                    <option value="Hirsutella_rhossiliensis">Hirsutella
                                                                        rhossiliensis
                                                                    </option>
                                                                    <option value="Histoplasma_capsulatum">Histoplasma
                                                                        capsulatum
                                                                    </option>
                                                                    <option
                                                                        value="Histoplasma_mississippiense_nom">Histoplasma
                                                                        mississippiense nom
                                                                    </option>
                                                                    <option value="Huiozyma_naganishii">Huiozyma
                                                                        naganishii
                                                                    </option>
                                                                    <option value="Hyaloscypha_bicolor">Hyaloscypha
                                                                        bicolor
                                                                    </option>
                                                                    <option value="Hyphopichia_burtonii">Hyphopichia
                                                                        burtonii
                                                                    </option>
                                                                    <option value="Hypoxylon_fragiforme">Hypoxylon
                                                                        fragiforme
                                                                    </option>
                                                                    <option value="Hypoxylon_trugodes">Hypoxylon
                                                                        trugodes
                                                                    </option>
                                                                    <option value="Ilyonectria_robusta">Ilyonectria
                                                                        robusta
                                                                    </option>
                                                                    <option value="Jaminaea_rosea">Jaminaea rosea
                                                                    </option>
                                                                    <option value="Kalmanozyma_brasiliensis">Kalmanozyma
                                                                        brasiliensis
                                                                    </option>
                                                                    <option value="Kazachstania_africana">Kazachstania
                                                                        africana
                                                                    </option>
                                                                    <option value="Kickxella_alabastrina">Kickxella
                                                                        alabastrina
                                                                    </option>
                                                                    <option value="Kluyveromyces_lactis">Kluyveromyces
                                                                        lactis
                                                                    </option>
                                                                    <option
                                                                        value="Kluyveromyces_marxianus">Kluyveromyces
                                                                        marxianus
                                                                    </option>
                                                                    <option value="Knufia_obscura">Knufia obscura
                                                                    </option>
                                                                    <option value="Kockiozyma_suomiensis">Kockiozyma
                                                                        suomiensis
                                                                    </option>
                                                                    <option value="Kockovaella_imperatae">Kockovaella
                                                                        imperatae
                                                                    </option>
                                                                    <option value="Komagataella_phaffii">Komagataella
                                                                        phaffii
                                                                    </option>
                                                                    <option value="Kuraishia_capsulata">Kuraishia
                                                                        capsulata
                                                                    </option>
                                                                    <option value="Kwoniella_bestiolae">Kwoniella
                                                                        bestiolae
                                                                    </option>
                                                                    <option value="Kwoniella_botswanensis">Kwoniella
                                                                        botswanensis
                                                                    </option>
                                                                    <option value="Kwoniella_dejecticola">Kwoniella
                                                                        dejecticola
                                                                    </option>
                                                                    <option value="Kwoniella_dendrophila">Kwoniella
                                                                        dendrophila
                                                                    </option>
                                                                    <option value="Kwoniella_europaea">Kwoniella
                                                                        europaea
                                                                    </option>
                                                                    <option value="Kwoniella_mangrovensis">Kwoniella
                                                                        mangrovensis
                                                                    </option>
                                                                    <option value="Kwoniella_newhampshirensis">Kwoniella
                                                                        newhampshirensis
                                                                    </option>
                                                                    <option value="Kwoniella_pini">Kwoniella pini
                                                                    </option>
                                                                    <option value="Kwoniella_shandongensis">Kwoniella
                                                                        shandongensis
                                                                    </option>
                                                                    <option value="Kwoniella_shivajii">Kwoniella
                                                                        shivajii
                                                                    </option>
                                                                    <option value="Laccaria_bicolor">Laccaria bicolor
                                                                    </option>
                                                                    <option value="Lachancea_lanzarotensis">Lachancea
                                                                        lanzarotensis
                                                                    </option>
                                                                    <option value="Lachancea_thermotolerans">Lachancea
                                                                        thermotolerans
                                                                    </option>
                                                                    <option value="Lachnellula_hyalina">Lachnellula
                                                                        hyalina
                                                                    </option>
                                                                    <option value="Laetiporus_sulphureus">Laetiporus
                                                                        sulphureus
                                                                    </option>
                                                                    <option
                                                                        value="Lasiodiplodia_theobromae">Lasiodiplodia
                                                                        theobromae
                                                                    </option>
                                                                    <option
                                                                        value="Lasiosphaeria_miniovina">Lasiosphaeria
                                                                        miniovina
                                                                    </option>
                                                                    <option value="Lentinula_edodes">Lentinula edodes
                                                                    </option>
                                                                    <option value="Lentinus_tigrinus">Lentinus
                                                                        tigrinus
                                                                    </option>
                                                                    <option
                                                                        value="Leptographium_clavigerum">Leptographium
                                                                        clavigerum
                                                                    </option>
                                                                    <option value="Letharia_columbiana">Letharia
                                                                        columbiana
                                                                    </option>
                                                                    <option value="Letharia_lupina">Letharia lupina
                                                                    </option>
                                                                    <option value="Lichtheimia_ornata">Lichtheimia
                                                                        ornata
                                                                    </option>
                                                                    <option value="Limtongia_smithiae">Limtongia
                                                                        smithiae
                                                                    </option>
                                                                    <option value="Linderina_pennispora">Linderina
                                                                        pennispora
                                                                    </option>
                                                                    <option value="Lindgomyces_ingoldianus">Lindgomyces
                                                                        ingoldianus
                                                                    </option>
                                                                    <option value="Lipomyces_arxii">Lipomyces arxii
                                                                    </option>
                                                                    <option value="Lipomyces_chichibuensis">Lipomyces
                                                                        chichibuensis
                                                                    </option>
                                                                    <option value="Lipomyces_doorenjongii">Lipomyces
                                                                        doorenjongii
                                                                    </option>
                                                                    <option value="Lipomyces_japonicus">Lipomyces
                                                                        japonicus
                                                                    </option>
                                                                    <option value="Lipomyces_oligophaga">Lipomyces
                                                                        oligophaga
                                                                    </option>
                                                                    <option value="Lipomyces_tetrasporus">Lipomyces
                                                                        tetrasporus
                                                                    </option>
                                                                    <option value="Lithohypha_guttulata">Lithohypha
                                                                        guttulata
                                                                    </option>
                                                                    <option
                                                                        value="Lobosporangium_transversale">Lobosporangium
                                                                        transversale
                                                                    </option>
                                                                    <option
                                                                        value="Lodderomyces_beijingensis">Lodderomyces
                                                                        beijingensis
                                                                    </option>
                                                                    <option
                                                                        value="Lodderomyces_elongisporus">Lodderomyces
                                                                        elongisporus
                                                                    </option>
                                                                    <option
                                                                        value="Macroventuria_anomochaeta">Macroventuria
                                                                        anomochaeta
                                                                    </option>
                                                                    <option value="Madurella_fahalii">Madurella
                                                                        fahalii
                                                                    </option>
                                                                    <option
                                                                        value="Magnusiomyces_paraingens">Magnusiomyces
                                                                        paraingens
                                                                    </option>
                                                                    <option value="Malassezia_globosa">Malassezia
                                                                        globosa
                                                                    </option>
                                                                    <option value="Malassezia_japonica">Malassezia
                                                                        japonica
                                                                    </option>
                                                                    <option value="Malassezia_pachydermatis">Malassezia
                                                                        pachydermatis
                                                                    </option>
                                                                    <option value="Malassezia_restricta">Malassezia
                                                                        restricta
                                                                    </option>
                                                                    <option value="Malassezia_sympodialis">Malassezia
                                                                        sympodialis
                                                                    </option>
                                                                    <option value="Malassezia_vespertilionis">Malassezia
                                                                        vespertilionis
                                                                    </option>
                                                                    <option value="Marasmius_oreades">Marasmius
                                                                        oreades
                                                                    </option>
                                                                    <option value="Maudiozyma_barnettii">Maudiozyma
                                                                        barnettii
                                                                    </option>
                                                                    <option value="Meira_miltonrushii">Meira
                                                                        miltonrushii
                                                                    </option>
                                                                    <option value="Melampsora_laricis">Melampsora
                                                                        laricis
                                                                    </option>
                                                                    <option value="Metarhizium_acridum">Metarhizium
                                                                        acridum
                                                                    </option>
                                                                    <option value="Metarhizium_album">Metarhizium
                                                                        album
                                                                    </option>
                                                                    <option value="Metarhizium_anisopliae">Metarhizium
                                                                        anisopliae
                                                                    </option>
                                                                    <option value="Metarhizium_brunneum">Metarhizium
                                                                        brunneum
                                                                    </option>
                                                                    <option value="Metarhizium_majus">Metarhizium
                                                                        majus
                                                                    </option>
                                                                    <option value="Metarhizium_robertsii">Metarhizium
                                                                        robertsii
                                                                    </option>
                                                                    <option
                                                                        value="Metschnikowia_bicuspidata">Metschnikowia
                                                                        bicuspidata
                                                                    </option>
                                                                    <option value="Meyerozyma_guilliermondii">Meyerozyma
                                                                        guilliermondii
                                                                    </option>
                                                                    <option
                                                                        value="Microdochium_trichocladiopsis">Microdochium
                                                                        trichocladiopsis
                                                                    </option>
                                                                    <option value="Microsporum_canis">Microsporum
                                                                        canis
                                                                    </option>
                                                                    <option value="Millerozyma_farinosa">Millerozyma
                                                                        farinosa
                                                                    </option>
                                                                    <option value="Mitosporidium_daphniae">Mitosporidium
                                                                        daphniae
                                                                    </option>
                                                                    <option value="Mixia_osmundae">Mixia osmundae
                                                                    </option>
                                                                    <option
                                                                        value="Moesziomyces_antarcticus">Moesziomyces
                                                                        antarcticus
                                                                    </option>
                                                                    <option value="Mollisia_scopiformis">Mollisia
                                                                        scopiformis
                                                                    </option>
                                                                    <option
                                                                        value="Moniliophthora_perniciosa">Moniliophthora
                                                                        perniciosa
                                                                    </option>
                                                                    <option value="Moniliophthora_roreri">Moniliophthora
                                                                        roreri
                                                                    </option>
                                                                    <option value="Morchella_importuna">Morchella
                                                                        importuna
                                                                    </option>
                                                                    <option value="Morchella_sextelata">Morchella
                                                                        sextelata
                                                                    </option>
                                                                    <option value="Mucor_mucedo">Mucor mucedo</option>
                                                                    <option value="Mucor_velutinosus">Mucor
                                                                        velutinosus
                                                                    </option>
                                                                    <option value="Mycena_indigotica">Mycena
                                                                        indigotica
                                                                    </option>
                                                                    <option value="Mycosarcoma_maydis">Mycosarcoma
                                                                        maydis
                                                                    </option>
                                                                    <option value="Mycothermus_thermophilus">Mycothermus
                                                                        thermophilus
                                                                    </option>
                                                                    <option value="Mycotypha_africana">Mycotypha
                                                                        africana
                                                                    </option>
                                                                    <option value="Mytilinidion_resinicola">Mytilinidion
                                                                        resinicola
                                                                    </option>
                                                                    <option value="Myxozyma_melibiosi">Myxozyma
                                                                        melibiosi
                                                                    </option>
                                                                    <option
                                                                        value="Nakaseomyces_bracarensis">Nakaseomyces
                                                                        bracarensis
                                                                    </option>
                                                                    <option value="Nakaseomyces_glabratus">Nakaseomyces
                                                                        glabratus
                                                                    </option>
                                                                    <option value="Nannizzia_gypsea">Nannizzia gypsea
                                                                    </option>
                                                                    <option value="Naumovozyma_castellii">Naumovozyma
                                                                        castellii
                                                                    </option>
                                                                    <option value="Naumovozyma_dairenensis">Naumovozyma
                                                                        dairenensis
                                                                    </option>
                                                                    <option value="Nematocida_ausubeli">Nematocida
                                                                        ausubeli
                                                                    </option>
                                                                    <option value="Nematocida_displodere">Nematocida
                                                                        displodere
                                                                    </option>
                                                                    <option value="Nematocida_homosporus">Nematocida
                                                                        homosporus
                                                                    </option>
                                                                    <option value="Nematocida_major">Nematocida major
                                                                    </option>
                                                                    <option value="Nematocida_minor">Nematocida minor
                                                                    </option>
                                                                    <option value="Nematocida_parisii">Nematocida
                                                                        parisii
                                                                    </option>
                                                                    <option value="Neoarthrinium_moseri">Neoarthrinium
                                                                        moseri
                                                                    </option>
                                                                    <option value="Neodothiora_populina">Neodothiora
                                                                        populina
                                                                    </option>
                                                                    <option value="Neofusicoccum_parvum">Neofusicoccum
                                                                        parvum
                                                                    </option>
                                                                    <option value="Neohortaea_acidophila">Neohortaea
                                                                        acidophila
                                                                    </option>
                                                                    <option value="Neurospora_crassa">Neurospora
                                                                        crassa
                                                                    </option>
                                                                    <option value="Neurospora_hispaniola">Neurospora
                                                                        hispaniola
                                                                    </option>
                                                                    <option value="Neurospora_tetrasperma">Neurospora
                                                                        tetrasperma
                                                                    </option>
                                                                    <option value="Neurospora_tetraspora">Neurospora
                                                                        tetraspora
                                                                    </option>
                                                                    <option value="Ogataea_angusta">Ogataea angusta
                                                                    </option>
                                                                    <option value="Ogataea_haglerorum">Ogataea
                                                                        haglerorum
                                                                    </option>
                                                                    <option value="Ogataea_parapolymorpha">Ogataea
                                                                        parapolymorpha
                                                                    </option>
                                                                    <option value="Ogataea_philodendri">Ogataea
                                                                        philodendri
                                                                    </option>
                                                                    <option value="Ogataea_polymorpha">Ogataea
                                                                        polymorpha
                                                                    </option>
                                                                    <option
                                                                        value="Ophidiomyces_ophidiicola">Ophidiomyces
                                                                        ophidiicola
                                                                    </option>
                                                                    <option value="Orbilia_oligospora">Orbilia
                                                                        oligospora
                                                                    </option>
                                                                    <option value="Ordospora_colligata">Ordospora
                                                                        colligata
                                                                    </option>
                                                                    <option value="Ordospora_pajunii">Ordospora
                                                                        pajunii
                                                                    </option>
                                                                    <option value="Paecilomyces_variotii">Paecilomyces
                                                                        variotii
                                                                    </option>
                                                                    <option
                                                                        value="Paracoccidioides_brasiliensis">Paracoccidioides
                                                                        brasiliensis
                                                                    </option>
                                                                    <option
                                                                        value="Paracoccidioides_lutzii">Paracoccidioides
                                                                        lutzii
                                                                    </option>
                                                                    <option
                                                                        value="Paraphaeosphaeria_sporulosa">Paraphaeosphaeria
                                                                        sporulosa
                                                                    </option>
                                                                    <option
                                                                        value="Parastagonospora_nodorum">Parastagonospora
                                                                        nodorum
                                                                    </option>
                                                                    <option
                                                                        value="Parathielavia_appendiculata">Parathielavia
                                                                        appendiculata
                                                                    </option>
                                                                    <option value="Penicilliopsis_zonata">Penicilliopsis
                                                                        zonata
                                                                    </option>
                                                                    <option value="Penicillium_alfredii">Penicillium
                                                                        alfredii
                                                                    </option>
                                                                    <option value="Penicillium_angulare">Penicillium
                                                                        angulare
                                                                    </option>
                                                                    <option value="Penicillium_antarcticum">Penicillium
                                                                        antarcticum
                                                                    </option>
                                                                    <option value="Penicillium_argentinense">Penicillium
                                                                        argentinense
                                                                    </option>
                                                                    <option value="Penicillium_arizonense">Penicillium
                                                                        arizonense
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_atrosanguineum">Penicillium
                                                                        atrosanguineum
                                                                    </option>
                                                                    <option value="Penicillium_bovifimosum">Penicillium
                                                                        bovifimosum
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_brevicompactum">Penicillium
                                                                        brevicompactum
                                                                    </option>
                                                                    <option value="Penicillium_canariense">Penicillium
                                                                        canariense
                                                                    </option>
                                                                    <option value="Penicillium_canescens">Penicillium
                                                                        canescens
                                                                    </option>
                                                                    <option value="Penicillium_cataractarum">Penicillium
                                                                        cataractarum
                                                                    </option>
                                                                    <option value="Penicillium_chermesinum">Penicillium
                                                                        chermesinum
                                                                    </option>
                                                                    <option value="Penicillium_chrysogenum">Penicillium
                                                                        chrysogenum
                                                                    </option>
                                                                    <option value="Penicillium_cinerascens">Penicillium
                                                                        cinerascens
                                                                    </option>
                                                                    <option value="Penicillium_citrinum">Penicillium
                                                                        citrinum
                                                                    </option>
                                                                    <option value="Penicillium_concentricum">Penicillium
                                                                        concentricum
                                                                    </option>
                                                                    <option value="Penicillium_coprophilum">Penicillium
                                                                        coprophilum
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_cosmopolitanum">Penicillium
                                                                        cosmopolitanum
                                                                    </option>
                                                                    <option value="Penicillium_crustosum">Penicillium
                                                                        crustosum
                                                                    </option>
                                                                    <option value="Penicillium_daleae">Penicillium
                                                                        daleae
                                                                    </option>
                                                                    <option value="Penicillium_diatomitis">Penicillium
                                                                        diatomitis
                                                                    </option>
                                                                    <option value="Penicillium_digitatum">Penicillium
                                                                        digitatum
                                                                    </option>
                                                                    <option value="Penicillium_expansum">Penicillium
                                                                        expansum
                                                                    </option>
                                                                    <option value="Penicillium_griseofulvum">Penicillium
                                                                        griseofulvum
                                                                    </option>
                                                                    <option value="Penicillium_hispanicum">Penicillium
                                                                        hispanicum
                                                                    </option>
                                                                    <option value="Penicillium_hordei">Penicillium
                                                                        hordei
                                                                    </option>
                                                                    <option value="Penicillium_lagena">Penicillium
                                                                        lagena
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_longicatenatum">Penicillium
                                                                        longicatenatum
                                                                    </option>
                                                                    <option value="Penicillium_maclennaniae">Penicillium
                                                                        maclennaniae
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_macrosclerotiorum">Penicillium
                                                                        macrosclerotiorum
                                                                    </option>
                                                                    <option value="Penicillium_malachiteum">Penicillium
                                                                        malachiteum
                                                                    </option>
                                                                    <option value="Penicillium_manginii">Penicillium
                                                                        manginii
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_mononematosum">Penicillium
                                                                        mononematosum
                                                                    </option>
                                                                    <option value="Penicillium_nucicola">Penicillium
                                                                        nucicola
                                                                    </option>
                                                                    <option value="Penicillium_odoratum">Penicillium
                                                                        odoratum
                                                                    </option>
                                                                    <option value="Penicillium_oxalicum">Penicillium
                                                                        oxalicum
                                                                    </option>
                                                                    <option value="Penicillium_paradoxum">Penicillium
                                                                        paradoxum
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_psychrosexuale">Penicillium
                                                                        psychrosexuale
                                                                    </option>
                                                                    <option value="Penicillium_pulvis">Penicillium
                                                                        pulvis
                                                                    </option>
                                                                    <option
                                                                        value="Penicillium_riverlandense">Penicillium
                                                                        riverlandense
                                                                    </option>
                                                                    <option value="Penicillium_robsamsonii">Penicillium
                                                                        robsamsonii
                                                                    </option>
                                                                    <option value="Penicillium_roqueforti">Penicillium
                                                                        roqueforti
                                                                    </option>
                                                                    <option value="Penicillium_rubens">Penicillium
                                                                        rubens
                                                                    </option>
                                                                    <option value="Penicillium_samsonianum">Penicillium
                                                                        samsonianum
                                                                    </option>
                                                                    <option value="Penicillium_solitum">Penicillium
                                                                        solitum
                                                                    </option>
                                                                    <option value="Penicillium_soppii">Penicillium
                                                                        soppii
                                                                    </option>
                                                                    <option value="Penicillium_subrubescens">Penicillium
                                                                        subrubescens
                                                                    </option>
                                                                    <option value="Penicillium_taxi">Penicillium taxi
                                                                    </option>
                                                                    <option value="Penicillium_verhagenii">Penicillium
                                                                        verhagenii
                                                                    </option>
                                                                    <option value="Penicillium_verrucosum">Penicillium
                                                                        verrucosum
                                                                    </option>
                                                                    <option value="Penicillium_vulpinum">Penicillium
                                                                        vulpinum
                                                                    </option>
                                                                    <option value="Penicillium_waksmanii">Penicillium
                                                                        waksmanii
                                                                    </option>
                                                                    <option value="Pestalotiopsis_fici">Pestalotiopsis
                                                                        fici
                                                                    </option>
                                                                    <option
                                                                        value="Phaeoacremonium_minimum">Phaeoacremonium
                                                                        minimum
                                                                    </option>
                                                                    <option value="Phanerochaete_carnosa">Phanerochaete
                                                                        carnosa
                                                                    </option>
                                                                    <option
                                                                        value="Phialemonium_atrogriseum">Phialemonium
                                                                        atrogriseum
                                                                    </option>
                                                                    <option value="Phycomyces_blakesleeanus">Phycomyces
                                                                        blakesleeanus
                                                                    </option>
                                                                    <option
                                                                        value="Phyllosticta_capitalensis">Phyllosticta
                                                                        capitalensis
                                                                    </option>
                                                                    <option
                                                                        value="Phyllosticta_citriasiana">Phyllosticta
                                                                        citriasiana
                                                                    </option>
                                                                    <option
                                                                        value="Phyllosticta_citribraziliensis">Phyllosticta
                                                                        citribraziliensis
                                                                    </option>
                                                                    <option value="Pichia_kudriavzevii">Pichia
                                                                        kudriavzevii
                                                                    </option>
                                                                    <option value="Pichia_membranifaciens">Pichia
                                                                        membranifaciens
                                                                    </option>
                                                                    <option value="Pisolithus_orientalis">Pisolithus
                                                                        orientalis
                                                                    </option>
                                                                    <option value="Plenodomus_lingam">Plenodomus
                                                                        lingam
                                                                    </option>
                                                                    <option value="Pleurotus_ostreatus">Pleurotus
                                                                        ostreatus
                                                                    </option>
                                                                    <option value="Pneumocystis_carinii">Pneumocystis
                                                                        carinii
                                                                    </option>
                                                                    <option value="Pneumocystis_jirovecii">Pneumocystis
                                                                        jirovecii
                                                                    </option>
                                                                    <option value="Pneumocystis_murina">Pneumocystis
                                                                        murina
                                                                    </option>
                                                                    <option value="Pochonia_chlamydosporia">Pochonia
                                                                        chlamydosporia
                                                                    </option>
                                                                    <option value="Podospora_anserina">Podospora
                                                                        anserina
                                                                    </option>
                                                                    <option value="Podospora_bellae">Podospora bellae
                                                                    </option>
                                                                    <option value="Podospora_pseudoanserina">Podospora
                                                                        pseudoanserina
                                                                    </option>
                                                                    <option value="Podospora_pseudocomata">Podospora
                                                                        pseudocomata
                                                                    </option>
                                                                    <option value="Podospora_pseudopauciseta">Podospora
                                                                        pseudopauciseta
                                                                    </option>
                                                                    <option value="Polychytrium_aggregatum">Polychytrium
                                                                        aggregatum
                                                                    </option>
                                                                    <option value="Priceomyces_carsonii">Priceomyces
                                                                        carsonii
                                                                    </option>
                                                                    <option value="Protomyces_lactucae">Protomyces
                                                                        lactucae
                                                                    </option>
                                                                    <option
                                                                        value="Pseudocercospora_fijiensis">Pseudocercospora
                                                                        fijiensis
                                                                    </option>
                                                                    <option
                                                                        value="Pseudogymnoascus_destructans">Pseudogymnoascus
                                                                        destructans
                                                                    </option>
                                                                    <option
                                                                        value="Pseudogymnoascus_verrucosus">Pseudogymnoascus
                                                                        verrucosus
                                                                    </option>
                                                                    <option
                                                                        value="Pseudomassariella_vexata">Pseudomassariella
                                                                        vexata
                                                                    </option>
                                                                    <option
                                                                        value="Pseudomicrostroma_glucosiphilum">Pseudomicrostroma
                                                                        glucosiphilum
                                                                    </option>
                                                                    <option
                                                                        value="Pseudovirgaria_hyperparasitica">Pseudovirgaria
                                                                        hyperparasitica
                                                                    </option>
                                                                    <option value="Pseudozyma_flocculosa">Pseudozyma
                                                                        flocculosa
                                                                    </option>
                                                                    <option value="Pseudozyma_hubeiensis">Pseudozyma
                                                                        hubeiensis
                                                                    </option>
                                                                    <option value="Psilocybe_cubensis">Psilocybe
                                                                        cubensis
                                                                    </option>
                                                                    <option value="Puccinia_graminis">Puccinia
                                                                        graminis
                                                                    </option>
                                                                    <option value="Puccinia_striiformis">Puccinia
                                                                        striiformis
                                                                    </option>
                                                                    <option value="Puccinia_triticina">Puccinia
                                                                        triticina
                                                                    </option>
                                                                    <option
                                                                        value="Punctularia_strigosozonata">Punctularia
                                                                        strigosozonata
                                                                    </option>
                                                                    <option
                                                                        value="Purpureocillium_lilacinum">Purpureocillium
                                                                        lilacinum
                                                                    </option>
                                                                    <option
                                                                        value="Purpureocillium_takamizusanense">Purpureocillium
                                                                        takamizusanense
                                                                    </option>
                                                                    <option value="Pyrenophora_teres">Pyrenophora
                                                                        teres
                                                                    </option>
                                                                    <option value="Pyrenophora_tritici">Pyrenophora
                                                                        tritici
                                                                    </option>
                                                                    <option value="Pyricularia_grisea">Pyricularia
                                                                        grisea
                                                                    </option>
                                                                    <option value="Pyricularia_oryzae">Pyricularia
                                                                        oryzae
                                                                    </option>
                                                                    <option
                                                                        value="Pyricularia_pennisetigena">Pyricularia
                                                                        pennisetigena
                                                                    </option>
                                                                    <option value="Radiomyces_spectabilis">Radiomyces
                                                                        spectabilis
                                                                    </option>
                                                                    <option value="Ramularia_collo">Ramularia collo
                                                                    </option>
                                                                    <option
                                                                        value="Rasamsonia_byssochlamydoides">Rasamsonia
                                                                        byssochlamydoides
                                                                    </option>
                                                                    <option value="Rasamsonia_emersonii">Rasamsonia
                                                                        emersonii
                                                                    </option>
                                                                    <option value="Recurvomyces_mirabilis">Recurvomyces
                                                                        mirabilis
                                                                    </option>
                                                                    <option value="Remersonia_thermophila">Remersonia
                                                                        thermophila
                                                                    </option>
                                                                    <option
                                                                        value="Rhinocladiella_mackenziei">Rhinocladiella
                                                                        mackenziei
                                                                    </option>
                                                                    <option value="Rhizoctonia_solani">Rhizoctonia
                                                                        solani
                                                                    </option>
                                                                    <option value="Rhizomucor_pusillus">Rhizomucor
                                                                        pusillus
                                                                    </option>
                                                                    <option value="Rhizophagus_irregularis">Rhizophagus
                                                                        irregularis
                                                                    </option>
                                                                    <option value="Rhizopus_delemar">Rhizopus delemar
                                                                    </option>
                                                                    <option value="Rhizopus_microsporus">Rhizopus
                                                                        microsporus
                                                                    </option>
                                                                    <option value="Rhodofomes_roseus">Rhodofomes
                                                                        roseus
                                                                    </option>
                                                                    <option value="Rhodonia_placenta">Rhodonia
                                                                        placenta
                                                                    </option>
                                                                    <option value="Rhodotorula_graminis">Rhodotorula
                                                                        graminis
                                                                    </option>
                                                                    <option value="Rhodotorula_toruloides">Rhodotorula
                                                                        toruloides
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomyces_arboricola">Saccharomyces
                                                                        arboricola
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomyces_cerevisiae">Saccharomyces
                                                                        cerevisiae
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomyces_eubayanus">Saccharomyces
                                                                        eubayanus
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomyces_kudriavzevii">Saccharomyces
                                                                        kudriavzevii
                                                                    </option>
                                                                    <option value="Saccharomyces_mikatae">Saccharomyces
                                                                        mikatae
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomyces_paradoxus">Saccharomyces
                                                                        paradoxus
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomycodes_ludwigii">Saccharomycodes
                                                                        ludwigii
                                                                    </option>
                                                                    <option
                                                                        value="Saccharomycopsis_crataegensis">Saccharomycopsis
                                                                        crataegensis
                                                                    </option>
                                                                    <option value="Saitoella_complicata">Saitoella
                                                                        complicata
                                                                    </option>
                                                                    <option value="Saxophila_tyrrhenica">Saxophila
                                                                        tyrrhenica
                                                                    </option>
                                                                    <option
                                                                        value="Scedosporium_apiospermum">Scedosporium
                                                                        apiospermum
                                                                    </option>
                                                                    <option
                                                                        value="Scheffersomyces_amazonensis">Scheffersomyces
                                                                        amazonensis
                                                                    </option>
                                                                    <option
                                                                        value="Scheffersomyces_coipomensis">Scheffersomyces
                                                                        coipomensis
                                                                    </option>
                                                                    <option
                                                                        value="Scheffersomyces_spartinae">Scheffersomyces
                                                                        spartinae
                                                                    </option>
                                                                    <option
                                                                        value="Scheffersomyces_stipitis">Scheffersomyces
                                                                        stipitis
                                                                    </option>
                                                                    <option
                                                                        value="Scheffersomyces_xylosifermentans">Scheffersomyces
                                                                        xylosifermentans
                                                                    </option>
                                                                    <option value="Schizophyllum_commune">Schizophyllum
                                                                        commune
                                                                    </option>
                                                                    <option
                                                                        value="Schizosaccharomyces_cryophilus">Schizosaccharomyces
                                                                        cryophilus
                                                                    </option>
                                                                    <option
                                                                        value="Schizosaccharomyces_japonicus">Schizosaccharomyces
                                                                        japonicus
                                                                    </option>
                                                                    <option
                                                                        value="Schizosaccharomyces_octosporus">Schizosaccharomyces
                                                                        octosporus
                                                                    </option>
                                                                    <option
                                                                        value="Schizosaccharomyces_osmophilus">Schizosaccharomyces
                                                                        osmophilus
                                                                    </option>
                                                                    <option
                                                                        value="Schizosaccharomyces_pombe">Schizosaccharomyces
                                                                        pombe
                                                                    </option>
                                                                    <option value="Sclerotinia_sclerotiorum">Sclerotinia
                                                                        sclerotiorum
                                                                    </option>
                                                                    <option value="Serpula_lacrymans">Serpula
                                                                        lacrymans
                                                                    </option>
                                                                    <option value="Sodiomyces_alcalophilus">Sodiomyces
                                                                        alcalophilus
                                                                    </option>
                                                                    <option value="Sodiomyces_alkalinus">Sodiomyces
                                                                        alkalinus
                                                                    </option>
                                                                    <option value="Sordaria_macrospora">Sordaria
                                                                        macrospora
                                                                    </option>
                                                                    <option value="Sparassis_crispa">Sparassis crispa
                                                                    </option>
                                                                    <option value="Spathaspora_passalidarum">Spathaspora
                                                                        passalidarum
                                                                    </option>
                                                                    <option value="Sphaerulina_musiva">Sphaerulina
                                                                        musiva
                                                                    </option>
                                                                    <option
                                                                        value="Spizellomyces_punctatus">Spizellomyces
                                                                        punctatus
                                                                    </option>
                                                                    <option value="Sporisorium_graminicola">Sporisorium
                                                                        graminicola
                                                                    </option>
                                                                    <option value="Sporothrix_brasiliensis">Sporothrix
                                                                        brasiliensis
                                                                    </option>
                                                                    <option value="Sporothrix_schenckii">Sporothrix
                                                                        schenckii
                                                                    </option>
                                                                    <option value="Stereum_hirsutum">Stereum hirsutum
                                                                    </option>
                                                                    <option
                                                                        value="Sugiyamaella_lignohabitans">Sugiyamaella
                                                                        lignohabitans
                                                                    </option>
                                                                    <option value="Suhomyces_tanzawaensis">Suhomyces
                                                                        tanzawaensis
                                                                    </option>
                                                                    <option value="Suillus_bovinus">Suillus bovinus
                                                                    </option>
                                                                    <option value="Suillus_clintonianus">Suillus
                                                                        clintonianus
                                                                    </option>
                                                                    <option value="Suillus_discolor">Suillus discolor
                                                                    </option>
                                                                    <option value="Suillus_fuscotomentosus">Suillus
                                                                        fuscotomentosus
                                                                    </option>
                                                                    <option value="Suillus_paluster">Suillus paluster
                                                                    </option>
                                                                    <option value="Suillus_plorans">Suillus plorans
                                                                    </option>
                                                                    <option value="Suillus_subalutaceus">Suillus
                                                                        subalutaceus
                                                                    </option>
                                                                    <option value="Suillus_subaureus">Suillus
                                                                        subaureus
                                                                    </option>
                                                                    <option value="Synchytrium_microbalum">Synchytrium
                                                                        microbalum
                                                                    </option>
                                                                    <option value="Talaromyces_amestolkiae">Talaromyces
                                                                        amestolkiae
                                                                    </option>
                                                                    <option value="Talaromyces_atroroseus">Talaromyces
                                                                        atroroseus
                                                                    </option>
                                                                    <option value="Talaromyces_marneffei">Talaromyces
                                                                        marneffei
                                                                    </option>
                                                                    <option
                                                                        value="Talaromyces_proteolyticus">Talaromyces
                                                                        proteolyticus
                                                                    </option>
                                                                    <option value="Talaromyces_rugulosus">Talaromyces
                                                                        rugulosus
                                                                    </option>
                                                                    <option value="Talaromyces_stipitatus">Talaromyces
                                                                        stipitatus
                                                                    </option>
                                                                    <option
                                                                        value="Tetrapisispora_phaffii">Tetrapisispora
                                                                        phaffii
                                                                    </option>
                                                                    <option value="Thermoascus_crustaceus">Thermoascus
                                                                        crustaceus
                                                                    </option>
                                                                    <option
                                                                        value="Thermochaetoides_thermophila">Thermochaetoides
                                                                        thermophila
                                                                    </option>
                                                                    <option value="Thermomyces_dupontii">Thermomyces
                                                                        dupontii
                                                                    </option>
                                                                    <option value="Thermomyces_lanuginosus">Thermomyces
                                                                        lanuginosus
                                                                    </option>
                                                                    <option
                                                                        value="Thermothelomyces_heterothallicus">Thermothelomyces
                                                                        heterothallicus
                                                                    </option>
                                                                    <option
                                                                        value="Thermothelomyces_thermophilus">Thermothelomyces
                                                                        thermophilus
                                                                    </option>
                                                                    <option
                                                                        value="Thermothielavioides_terrestris">Thermothielavioides
                                                                        terrestris
                                                                    </option>
                                                                    <option value="Thyridium_curvatum">Thyridium
                                                                        curvatum
                                                                    </option>
                                                                    <option value="Tilletiaria_anomala">Tilletiaria
                                                                        anomala
                                                                    </option>
                                                                    <option
                                                                        value="Tilletiopsis_washingtonensis">Tilletiopsis
                                                                        washingtonensis
                                                                    </option>
                                                                    <option value="Torulaspora_delbrueckii">Torulaspora
                                                                        delbrueckii
                                                                    </option>
                                                                    <option value="Torulaspora_globosa">Torulaspora
                                                                        globosa
                                                                    </option>
                                                                    <option value="Trametes_versicolor">Trametes
                                                                        versicolor
                                                                    </option>
                                                                    <option
                                                                        value="Trematosphaeria_pertusa">Trematosphaeria
                                                                        pertusa
                                                                    </option>
                                                                    <option value="Tremella_mesenterica">Tremella
                                                                        mesenterica
                                                                    </option>
                                                                    <option value="Tricharina_praecox">Tricharina
                                                                        praecox
                                                                    </option>
                                                                    <option value="Trichoderma_aggressivum">Trichoderma
                                                                        aggressivum
                                                                    </option>
                                                                    <option value="Trichoderma_asperellum">Trichoderma
                                                                        asperellum
                                                                    </option>
                                                                    <option value="Trichoderma_atroviride">Trichoderma
                                                                        atroviride
                                                                    </option>
                                                                    <option value="Trichoderma_breve">Trichoderma
                                                                        breve
                                                                    </option>
                                                                    <option
                                                                        value="Trichoderma_citrinoviride">Trichoderma
                                                                        citrinoviride
                                                                    </option>
                                                                    <option value="Trichoderma_gamsii">Trichoderma
                                                                        gamsii
                                                                    </option>
                                                                    <option value="Trichoderma_harzianum">Trichoderma
                                                                        harzianum
                                                                    </option>
                                                                    <option value="Trichoderma_reesei">Trichoderma
                                                                        reesei
                                                                    </option>
                                                                    <option value="Trichoderma_virens">Trichoderma
                                                                        virens
                                                                    </option>
                                                                    <option value="Trichophyton_benhamiae">Trichophyton
                                                                        benhamiae
                                                                    </option>
                                                                    <option value="Trichophyton_rubrum">Trichophyton
                                                                        rubrum
                                                                    </option>
                                                                    <option value="Trichophyton_verrucosum">Trichophyton
                                                                        verrucosum
                                                                    </option>
                                                                    <option value="Trichosporon_asahii">Trichosporon
                                                                        asahii
                                                                    </option>
                                                                    <option value="Truncatella_angustata">Truncatella
                                                                        angustata
                                                                    </option>
                                                                    <option value="Tuber_melanosporum">Tuber
                                                                        melanosporum
                                                                    </option>
                                                                    <option value="Umbelopsis_ramanniana">Umbelopsis
                                                                        ramanniana
                                                                    </option>
                                                                    <option value="Uncinocarpus_reesii">Uncinocarpus
                                                                        reesii
                                                                    </option>
                                                                    <option value="Ustilaginoidea_virens">Ustilaginoidea
                                                                        virens
                                                                    </option>
                                                                    <option value="Ustilago_hordei">Ustilago hordei
                                                                    </option>
                                                                    <option value="Vairimorpha_ceranae">Vairimorpha
                                                                        ceranae
                                                                    </option>
                                                                    <option value="Vairimorpha_necatrix">Vairimorpha
                                                                        necatrix
                                                                    </option>
                                                                    <option
                                                                        value="Vanderwaltozyma_polyspora">Vanderwaltozyma
                                                                        polyspora
                                                                    </option>
                                                                    <option value="Vanrija_albida">Vanrija albida
                                                                    </option>
                                                                    <option value="Vanrija_pseudolonga">Vanrija
                                                                        pseudolonga
                                                                    </option>
                                                                    <option value="Vavraia_culicis">Vavraia culicis
                                                                    </option>
                                                                    <option
                                                                        value="Venustampulla_echinocandica">Venustampulla
                                                                        echinocandica
                                                                    </option>
                                                                    <option value="Verruconis_gallopava">Verruconis
                                                                        gallopava
                                                                    </option>
                                                                    <option value="Verticillium_alfalfae">Verticillium
                                                                        alfalfae
                                                                    </option>
                                                                    <option value="Verticillium_dahliae">Verticillium
                                                                        dahliae
                                                                    </option>
                                                                    <option
                                                                        value="Verticillium_nonalfalfae">Verticillium
                                                                        nonalfalfae
                                                                    </option>
                                                                    <option value="Vittaforma_corneae">Vittaforma
                                                                        corneae
                                                                    </option>
                                                                    <option value="Wallemia_ichthyophaga">Wallemia
                                                                        ichthyophaga
                                                                    </option>
                                                                    <option value="Wallemia_mellicola">Wallemia
                                                                        mellicola
                                                                    </option>
                                                                    <option value="Westerdykella_ornata">Westerdykella
                                                                        ornata
                                                                    </option>
                                                                    <option
                                                                        value="Wickerhamiella_sorbophila">Wickerhamiella
                                                                        sorbophila
                                                                    </option>
                                                                    <option
                                                                        value="Wickerhamomyces_anomalus">Wickerhamomyces
                                                                        anomalus
                                                                    </option>
                                                                    <option
                                                                        value="Wickerhamomyces_ciferrii">Wickerhamomyces
                                                                        ciferrii
                                                                    </option>
                                                                    <option value="Xylaria_bambusicola">Xylaria
                                                                        bambusicola
                                                                    </option>
                                                                    <option value="Xylona_heveae">Xylona heveae</option>
                                                                    <option value="Yamadazyma_tenuis">Yamadazyma
                                                                        tenuis
                                                                    </option>
                                                                    <option value="Yarrowia_lipolytica">Yarrowia
                                                                        lipolytica
                                                                    </option>
                                                                    <option value="Zasmidium_cellare">Zasmidium
                                                                        cellare
                                                                    </option>
                                                                    <option value="Zychaea_mexicana">Zychaea mexicana
                                                                    </option>
                                                                    <option
                                                                        value="Zygosaccharomyces_rouxii">Zygosaccharomyces
                                                                        rouxii
                                                                    </option>
                                                                    <option
                                                                        value="Zygotorulaspora_mrakii">Zygotorulaspora
                                                                        mrakii
                                                                    </option>
                                                                    <option value="Zymoseptoria_tritici">Zymoseptoria
                                                                        tritici
                                                                    </option>
                                                                    <option value="_Candida_subhashii"> Candida
                                                                        subhashii
                                                                    </option>

                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "invertebrate" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option value="Diabrotica_virgifera">Diabrotica
                                                                        virgifera
                                                                    </option>
                                                                    <option value="Diachasma_alloeum">Diachasma
                                                                        alloeum
                                                                    </option>
                                                                    <option
                                                                        value="Diachasmimorpha_longicaudata">Diachasmimorpha
                                                                        longicaudata
                                                                    </option>
                                                                    <option value="Diaphorina_citri">Diaphorina citri
                                                                    </option>
                                                                    <option value="Dinoponera_quadriceps">Dinoponera
                                                                        quadriceps
                                                                    </option>
                                                                    <option value="Diorhabda_carinulata">Diorhabda
                                                                        carinulata
                                                                    </option>
                                                                    <option value="Diorhabda_sublineata">Diorhabda
                                                                        sublineata
                                                                    </option>
                                                                    <option value="Diprion_similis">Diprion similis
                                                                    </option>
                                                                    <option value="Diuraphis_noxia">Diuraphis noxia
                                                                    </option>
                                                                    <option value="Dreissena_polymorpha">Dreissena
                                                                        polymorpha
                                                                    </option>
                                                                    <option value="Drosophila_albomicans">Drosophila
                                                                        albomicans
                                                                    </option>
                                                                    <option value="Drosophila_ananassae">Drosophila
                                                                        ananassae
                                                                    </option>
                                                                    <option value="Drosophila_arizonae">Drosophila
                                                                        arizonae
                                                                    </option>
                                                                    <option value="Drosophila_biarmipes">Drosophila
                                                                        biarmipes
                                                                    </option>
                                                                    <option value="Drosophila_bipectinata">Drosophila
                                                                        bipectinata
                                                                    </option>
                                                                    <option value="Drosophila_busckii">Drosophila
                                                                        busckii
                                                                    </option>
                                                                    <option value="Drosophila_elegans">Drosophila
                                                                        elegans
                                                                    </option>
                                                                    <option value="Drosophila_erecta">Drosophila
                                                                        erecta
                                                                    </option>
                                                                    <option value="Drosophila_eugracilis">Drosophila
                                                                        eugracilis
                                                                    </option>
                                                                    <option value="Drosophila_ficusphila">Drosophila
                                                                        ficusphila
                                                                    </option>
                                                                    <option value="Drosophila_grimshawi">Drosophila
                                                                        grimshawi
                                                                    </option>
                                                                    <option value="Drosophila_guanche">Drosophila
                                                                        guanche
                                                                    </option>
                                                                    <option value="Drosophila_gunungcola">Drosophila
                                                                        gunungcola
                                                                    </option>
                                                                    <option value="Drosophila_hydei">Drosophila hydei
                                                                    </option>
                                                                    <option value="Drosophila_innubila">Drosophila
                                                                        innubila
                                                                    </option>
                                                                    <option value="Drosophila_kikkawai">Drosophila
                                                                        kikkawai
                                                                    </option>
                                                                    <option value="Drosophila_mauritiana">Drosophila
                                                                        mauritiana
                                                                    </option>
                                                                    <option value="Drosophila_melanogaster">Drosophila
                                                                        melanogaster
                                                                    </option>
                                                                    <option value="Drosophila_miranda">Drosophila
                                                                        miranda
                                                                    </option>
                                                                    <option value="Drosophila_mojavensis">Drosophila
                                                                        mojavensis
                                                                    </option>
                                                                    <option value="Drosophila_montana">Drosophila
                                                                        montana
                                                                    </option>
                                                                    <option value="Drosophila_nasuta">Drosophila
                                                                        nasuta
                                                                    </option>
                                                                    <option value="Drosophila_navojoa">Drosophila
                                                                        navojoa
                                                                    </option>
                                                                    <option value="Drosophila_novamexicana">Drosophila
                                                                        novamexicana
                                                                    </option>
                                                                    <option value="Drosophila_obscura">Drosophila
                                                                        obscura
                                                                    </option>
                                                                    <option value="Drosophila_persimilis">Drosophila
                                                                        persimilis
                                                                    </option>
                                                                    <option value="Drosophila_pseudoobscura">Drosophila
                                                                        pseudoobscura
                                                                    </option>
                                                                    <option value="Drosophila_rhopaloa">Drosophila
                                                                        rhopaloa
                                                                    </option>
                                                                    <option value="Drosophila_santomea">Drosophila
                                                                        santomea
                                                                    </option>
                                                                    <option value="Drosophila_sechellia">Drosophila
                                                                        sechellia
                                                                    </option>
                                                                    <option value="Drosophila_serrata">Drosophila
                                                                        serrata
                                                                    </option>
                                                                    <option value="Drosophila_simulans">Drosophila
                                                                        simulans
                                                                    </option>
                                                                    <option value="Drosophila_subobscura">Drosophila
                                                                        subobscura
                                                                    </option>
                                                                    <option value="Drosophila_subpulchrella">Drosophila
                                                                        subpulchrella
                                                                    </option>
                                                                    <option value="Drosophila_sulfurigaster">Drosophila
                                                                        sulfurigaster
                                                                    </option>
                                                                    <option value="Drosophila_suzukii">Drosophila
                                                                        suzukii
                                                                    </option>
                                                                    <option value="Drosophila_takahashii">Drosophila
                                                                        takahashii
                                                                    </option>
                                                                    <option value="Drosophila_teissieri">Drosophila
                                                                        teissieri
                                                                    </option>
                                                                    <option value="Drosophila_tropicalis">Drosophila
                                                                        tropicalis
                                                                    </option>
                                                                    <option value="Drosophila_virilis">Drosophila
                                                                        virilis
                                                                    </option>
                                                                    <option value="Drosophila_willistoni">Drosophila
                                                                        willistoni
                                                                    </option>
                                                                    <option value="Drosophila_yakuba">Drosophila
                                                                        yakuba
                                                                    </option>
                                                                    <option value="Dufourea_novaeangliae">Dufourea
                                                                        novaeangliae
                                                                    </option>
                                                                    <option value="Dysidea_avara">Dysidea avara</option>
                                                                    <option value="Echinococcus_granulosus">Echinococcus
                                                                        granulosus
                                                                    </option>
                                                                    <option value="Episyrphus_balteatus">Episyrphus
                                                                        balteatus
                                                                    </option>
                                                                    <option value="Eriocheir_sinensis">Eriocheir
                                                                        sinensis
                                                                    </option>
                                                                    <option value="Eufriesea_mexicana">Eufriesea
                                                                        mexicana
                                                                    </option>
                                                                    <option value="Eupeodes_corollae">Eupeodes
                                                                        corollae
                                                                    </option>
                                                                    <option value="Eurosta_solidaginis">Eurosta
                                                                        solidaginis
                                                                    </option>
                                                                    <option value="Eurytemora_affinis">Eurytemora
                                                                        affinis
                                                                    </option>
                                                                    <option value="Eurytemora_carolleeae">Eurytemora
                                                                        carolleeae
                                                                    </option>
                                                                    <option value="Euwallacea_fornicatus">Euwallacea
                                                                        fornicatus
                                                                    </option>
                                                                    <option value="Euwallacea_similis">Euwallacea
                                                                        similis
                                                                    </option>
                                                                    <option value="Exaiptasia_diaphana">Exaiptasia
                                                                        diaphana
                                                                    </option>
                                                                    <option value="Folsomia_candida">Folsomia candida
                                                                    </option>
                                                                    <option value="Fonticula_alba">Fonticula alba
                                                                    </option>
                                                                    <option value="Fopius_arisanus">Fopius arisanus
                                                                    </option>
                                                                    <option value="Formica_exsecta">Formica exsecta
                                                                    </option>
                                                                    <option
                                                                        value="Frankliniella_occidentalis">Frankliniella
                                                                        occidentalis
                                                                    </option>
                                                                    <option value="Frieseomelitta_varia">Frieseomelitta
                                                                        varia
                                                                    </option>
                                                                    <option value="Galendromus_occidentalis">Galendromus
                                                                        occidentalis
                                                                    </option>
                                                                    <option value="Galleria_mellonella">Galleria
                                                                        mellonella
                                                                    </option>
                                                                    <option value="Gigantopelta_aegis">Gigantopelta
                                                                        aegis
                                                                    </option>
                                                                    <option value="Glossina_fuscipes">Glossina
                                                                        fuscipes
                                                                    </option>
                                                                    <option value="Gordionus_sp">Gordionus sp</option>
                                                                    <option value="Habropoda_laboriosa">Habropoda
                                                                        laboriosa
                                                                    </option>
                                                                    <option value="Halichondria_panicea">Halichondria
                                                                        panicea
                                                                    </option>
                                                                    <option value="Haliotis_asinina">Haliotis asinina
                                                                    </option>
                                                                    <option value="Haliotis_cracherodii">Haliotis
                                                                        cracherodii
                                                                    </option>
                                                                    <option value="Haliotis_rubra">Haliotis rubra
                                                                    </option>
                                                                    <option value="Haliotis_rufescens">Haliotis
                                                                        rufescens
                                                                    </option>
                                                                    <option value="Halyomorpha_halys">Halyomorpha
                                                                        halys
                                                                    </option>
                                                                    <option value="Harmonia_axyridis">Harmonia
                                                                        axyridis
                                                                    </option>
                                                                    <option value="Harpegnathos_saltator">Harpegnathos
                                                                        saltator
                                                                    </option>
                                                                    <option value="Helicoverpa_armigera">Helicoverpa
                                                                        armigera
                                                                    </option>
                                                                    <option value="Helicoverpa_zea">Helicoverpa zea
                                                                    </option>
                                                                    <option value="Helobdella_robusta">Helobdella
                                                                        robusta
                                                                    </option>
                                                                    <option value="Hermetia_illucens">Hermetia
                                                                        illucens
                                                                    </option>
                                                                    <option value="Homalodisca_vitripennis">Homalodisca
                                                                        vitripennis
                                                                    </option>
                                                                    <option value="Homarus_americanus">Homarus
                                                                        americanus
                                                                    </option>
                                                                    <option value="Hyalella_azteca">Hyalella azteca
                                                                    </option>
                                                                    <option value="Hydra_vulgaris">Hydra vulgaris
                                                                    </option>
                                                                    <option
                                                                        value="Hydractinia_symbiolongicarpus">Hydractinia
                                                                        symbiolongicarpus
                                                                    </option>
                                                                    <option value="Hylaeus_anthracinus">Hylaeus
                                                                        anthracinus
                                                                    </option>
                                                                    <option value="Hylaeus_volcanicus">Hylaeus
                                                                        volcanicus
                                                                    </option>
                                                                    <option value="Hyposmocoma_kahamanoa">Hyposmocoma
                                                                        kahamanoa
                                                                    </option>
                                                                    <option value="Ischnura_elegans">Ischnura elegans
                                                                    </option>
                                                                    <option value="Ixodes_scapularis">Ixodes
                                                                        scapularis
                                                                    </option>
                                                                    <option
                                                                        value="Leguminivora_glycinivorella">Leguminivora
                                                                        glycinivorella
                                                                    </option>
                                                                    <option
                                                                        value="Lepeophtheirus_salmonis">Lepeophtheirus
                                                                        salmonis
                                                                    </option>
                                                                    <option value="Leptidea_sinapis">Leptidea sinapis
                                                                    </option>
                                                                    <option
                                                                        value="Leptinotarsa_decemlineata">Leptinotarsa
                                                                        decemlineata
                                                                    </option>
                                                                    <option value="Leptopilina_boulardi">Leptopilina
                                                                        boulardi
                                                                    </option>
                                                                    <option value="Leptopilina_heterotoma">Leptopilina
                                                                        heterotoma
                                                                    </option>
                                                                    <option value="Limulus_polyphemus">Limulus
                                                                        polyphemus
                                                                    </option>
                                                                    <option value="Linepithema_humile">Linepithema
                                                                        humile
                                                                    </option>
                                                                    <option value="Lineus_longissimus">Lineus
                                                                        longissimus
                                                                    </option>
                                                                    <option value="Lingula_anatina">Lingula anatina
                                                                    </option>
                                                                    <option value="Liolophura_japonica">Liolophura
                                                                        japonica
                                                                    </option>
                                                                    <option value="Littorina_saxatilis">Littorina
                                                                        saxatilis
                                                                    </option>
                                                                    <option value="Loa_loa">Loa loa</option>
                                                                    <option value="Lottia_gigantea">Lottia gigantea
                                                                    </option>
                                                                    <option value="Lucilia_cuprina">Lucilia cuprina
                                                                    </option>
                                                                    <option value="Lucilia_sericata">Lucilia sericata
                                                                    </option>
                                                                    <option value="Lutzomyia_longipalpis">Lutzomyia
                                                                        longipalpis
                                                                    </option>
                                                                    <option value="Lytechinus_pictus">Lytechinus
                                                                        pictus
                                                                    </option>
                                                                    <option value="Lytechinus_variegatus">Lytechinus
                                                                        variegatus
                                                                    </option>
                                                                    <option
                                                                        value="Macrobrachium_nipponense">Macrobrachium
                                                                        nipponense
                                                                    </option>
                                                                    <option
                                                                        value="Macrobrachium_rosenbergii">Macrobrachium
                                                                        rosenbergii
                                                                    </option>
                                                                    <option
                                                                        value="Macrosteles_quadrilineatus">Macrosteles
                                                                        quadrilineatus
                                                                    </option>
                                                                    <option value="Magallana_angulata">Magallana
                                                                        angulata
                                                                    </option>
                                                                    <option value="Magallana_gigas">Magallana gigas
                                                                    </option>
                                                                    <option value="Malaya_genurostris">Malaya
                                                                        genurostris
                                                                    </option>
                                                                    <option value="Manduca_sexta">Manduca sexta</option>
                                                                    <option value="Maniola_hyperantus">Maniola
                                                                        hyperantus
                                                                    </option>
                                                                    <option value="Maniola_jurtina">Maniola jurtina
                                                                    </option>
                                                                    <option value="Megachile_rotundata">Megachile
                                                                        rotundata
                                                                    </option>
                                                                    <option value="Megalopta_genalis">Megalopta
                                                                        genalis
                                                                    </option>
                                                                    <option value="Melanaphis_sacchari">Melanaphis
                                                                        sacchari
                                                                    </option>
                                                                    <option value="Melitaea_cinxia">Melitaea cinxia
                                                                    </option>
                                                                    <option value="Mercenaria_mercenaria">Mercenaria
                                                                        mercenaria
                                                                    </option>
                                                                    <option value="Metopolophium_dirhodum">Metopolophium
                                                                        dirhodum
                                                                    </option>
                                                                    <option value="Microplitis_demolitor">Microplitis
                                                                        demolitor
                                                                    </option>
                                                                    <option value="Microplitis_mediator">Microplitis
                                                                        mediator
                                                                    </option>
                                                                    <option value="Mizuhopecten_yessoensis">Mizuhopecten
                                                                        yessoensis
                                                                    </option>
                                                                    <option value="Monomorium_pharaonis">Monomorium
                                                                        pharaonis
                                                                    </option>
                                                                    <option value="Monosiga_brevicollis">Monosiga
                                                                        brevicollis
                                                                    </option>
                                                                    <option value="Montipora_capricornis">Montipora
                                                                        capricornis
                                                                    </option>
                                                                    <option value="Montipora_foliosa">Montipora
                                                                        foliosa
                                                                    </option>
                                                                    <option value="Musca_domestica">Musca domestica
                                                                    </option>
                                                                    <option value="Musca_vetustissima">Musca
                                                                        vetustissima
                                                                    </option>
                                                                    <option value="Mya_arenaria">Mya arenaria</option>
                                                                    <option value="Mytilus_californianus">Mytilus
                                                                        californianus
                                                                    </option>
                                                                    <option value="Mytilus_edulis">Mytilus edulis
                                                                    </option>
                                                                    <option value="Mytilus_trossulus">Mytilus
                                                                        trossulus
                                                                    </option>
                                                                    <option value="Myzus_persicae">Myzus persicae
                                                                    </option>
                                                                    <option value="Nasonia_vitripennis">Nasonia
                                                                        vitripennis
                                                                    </option>
                                                                    <option value="Necator_americanus">Necator
                                                                        americanus
                                                                    </option>
                                                                    <option value="Nematostella_vectensis">Nematostella
                                                                        vectensis
                                                                    </option>
                                                                    <option value="Neocloeon_triangulifer">Neocloeon
                                                                        triangulifer
                                                                    </option>
                                                                    <option value="Neodiprion_fabricii">Neodiprion
                                                                        fabricii
                                                                    </option>
                                                                    <option value="Neodiprion_lecontei">Neodiprion
                                                                        lecontei
                                                                    </option>
                                                                    <option value="Neodiprion_pinetum">Neodiprion
                                                                        pinetum
                                                                    </option>
                                                                    <option value="Neodiprion_virginianus">Neodiprion
                                                                        virginianus
                                                                    </option>
                                                                    <option value="Nicrophorus_vespilloides">Nicrophorus
                                                                        vespilloides
                                                                    </option>
                                                                    <option value="Nilaparvata_lugens">Nilaparvata
                                                                        lugens
                                                                    </option>
                                                                    <option value="Nomia_melanderi">Nomia melanderi
                                                                    </option>
                                                                    <option value="Nylanderia_fulva">Nylanderia fulva
                                                                    </option>
                                                                    <option value="Nymphalis_io">Nymphalis io</option>
                                                                    <option
                                                                        value="Ochlerotatus_camptorhynchus">Ochlerotatus
                                                                        camptorhynchus
                                                                    </option>
                                                                    <option value="Octopus_bimaculoides">Octopus
                                                                        bimaculoides
                                                                    </option>
                                                                    <option value="Octopus_sinensis">Octopus sinensis
                                                                    </option>
                                                                    <option value="Octopus_vulgaris">Octopus vulgaris
                                                                    </option>
                                                                    <option value="Odontomachus_brunneus">Odontomachus
                                                                        brunneus
                                                                    </option>
                                                                    <option value="Onthophagus_taurus">Onthophagus
                                                                        taurus
                                                                    </option>
                                                                    <option value="Ooceraea_biroi">Ooceraea biroi
                                                                    </option>
                                                                    <option value="Opisthorchis_viverrini">Opisthorchis
                                                                        viverrini
                                                                    </option>
                                                                    <option value="Oppia_nitens">Oppia nitens</option>
                                                                    <option value="Orbicella_faveolata">Orbicella
                                                                        faveolata
                                                                    </option>
                                                                    <option value="Ornithodoros_turicata">Ornithodoros
                                                                        turicata
                                                                    </option>
                                                                    <option value="Orussus_abietinus">Orussus
                                                                        abietinus
                                                                    </option>
                                                                    <option value="Oscarella_lobularis">Oscarella
                                                                        lobularis
                                                                    </option>
                                                                    <option value="Osmia_bicornis">Osmia bicornis
                                                                    </option>
                                                                    <option value="Osmia_lignaria">Osmia lignaria
                                                                    </option>
                                                                    <option value="Ostrea_edulis">Ostrea edulis</option>
                                                                    <option value="Ostrinia_furnacalis">Ostrinia
                                                                        furnacalis
                                                                    </option>
                                                                    <option value="Ostrinia_nubilalis">Ostrinia
                                                                        nubilalis
                                                                    </option>
                                                                    <option value="Palaemon_carinicauda">Palaemon
                                                                        carinicauda
                                                                    </option>
                                                                    <option value="Panonychus_citri">Panonychus citri
                                                                    </option>
                                                                    <option value="Papilio_machaon">Papilio machaon
                                                                    </option>
                                                                    <option value="Papilio_polytes">Papilio polytes
                                                                    </option>
                                                                    <option value="Papilio_xuthus">Papilio xuthus
                                                                    </option>
                                                                    <option
                                                                        value="Paramacrobiotus_metropolitanus">Paramacrobiotus
                                                                        metropolitanus
                                                                    </option>
                                                                    <option value="Pararge_aegeria">Pararge aegeria
                                                                    </option>
                                                                    <option
                                                                        value="Parasteatoda_tepidariorum">Parasteatoda
                                                                        tepidariorum
                                                                    </option>
                                                                    <option value="Patella_vulgata">Patella vulgata
                                                                    </option>
                                                                    <option value="Patiria_miniata">Patiria miniata
                                                                    </option>
                                                                    <option value="Pecten_maximus">Pecten maximus
                                                                    </option>
                                                                    <option
                                                                        value="Pectinophora_gossypiella">Pectinophora
                                                                        gossypiella
                                                                    </option>
                                                                    <option value="Pediculus_humanus">Pediculus
                                                                        humanus
                                                                    </option>
                                                                    <option value="Penaeus_chinensis">Penaeus
                                                                        chinensis
                                                                    </option>
                                                                    <option value="Penaeus_indicus">Penaeus indicus
                                                                    </option>
                                                                    <option value="Penaeus_japonicus">Penaeus
                                                                        japonicus
                                                                    </option>
                                                                    <option value="Penaeus_monodon">Penaeus monodon
                                                                    </option>
                                                                    <option value="Penaeus_vannamei">Penaeus vannamei
                                                                    </option>
                                                                    <option value="Periplaneta_americana">Periplaneta
                                                                        americana
                                                                    </option>
                                                                    <option value="Phlebotomus_argentipes">Phlebotomus
                                                                        argentipes
                                                                    </option>
                                                                    <option value="Phlebotomus_papatasi">Phlebotomus
                                                                        papatasi
                                                                    </option>
                                                                    <option value="Photinus_pyralis">Photinus pyralis
                                                                    </option>
                                                                    <option value="Phymastichus_coffea">Phymastichus
                                                                        coffea
                                                                    </option>
                                                                    <option value="Physella_acuta">Physella acuta
                                                                    </option>
                                                                    <option value="Pieris_brassicae">Pieris brassicae
                                                                    </option>
                                                                    <option value="Pieris_napi">Pieris napi</option>
                                                                    <option value="Pieris_rapae">Pieris rapae</option>
                                                                    <option value="Planococcus_citri">Planococcus
                                                                        citri
                                                                    </option>
                                                                    <option value="Plodia_interpunctella">Plodia
                                                                        interpunctella
                                                                    </option>
                                                                    <option value="Plutella_xylostella">Plutella
                                                                        xylostella
                                                                    </option>
                                                                    <option value="Pocillopora_damicornis">Pocillopora
                                                                        damicornis
                                                                    </option>
                                                                    <option value="Pocillopora_verrucosa">Pocillopora
                                                                        verrucosa
                                                                    </option>
                                                                    <option value="Pogonomyrmex_barbatus">Pogonomyrmex
                                                                        barbatus
                                                                    </option>
                                                                    <option value="Polistes_canadensis">Polistes
                                                                        canadensis
                                                                    </option>
                                                                    <option value="Polistes_dominula">Polistes
                                                                        dominula
                                                                    </option>
                                                                    <option value="Polistes_fuscatus">Polistes
                                                                        fuscatus
                                                                    </option>
                                                                    <option value="Pollicipes_pollicipes">Pollicipes
                                                                        pollicipes
                                                                    </option>
                                                                    <option value="Polyergus_mexicanus">Polyergus
                                                                        mexicanus
                                                                    </option>
                                                                    <option value="Pomacea_canaliculata">Pomacea
                                                                        canaliculata
                                                                    </option>
                                                                    <option value="Portunus_trituberculatus">Portunus
                                                                        trituberculatus
                                                                    </option>
                                                                    <option value="Priapulus_caudatus">Priapulus
                                                                        caudatus
                                                                    </option>
                                                                    <option value="Procambarus_clarkii">Procambarus
                                                                        clarkii
                                                                    </option>
                                                                    <option value="Prorops_nasuta">Prorops nasuta
                                                                    </option>
                                                                    <option value="Pseudomyrmex_gracilis">Pseudomyrmex
                                                                        gracilis
                                                                    </option>
                                                                    <option value="Ptychodera_flava">Ptychodera flava
                                                                    </option>
                                                                    <option value="Rhagoletis_pomonella">Rhagoletis
                                                                        pomonella
                                                                    </option>
                                                                    <option value="Rhagoletis_zephyria">Rhagoletis
                                                                        zephyria
                                                                    </option>
                                                                    <option
                                                                        value="Rhipicephalus_microplus">Rhipicephalus
                                                                        microplus
                                                                    </option>
                                                                    <option
                                                                        value="Rhipicephalus_sanguineus">Rhipicephalus
                                                                        sanguineus
                                                                    </option>
                                                                    <option value="Rhopalosiphum_maidis">Rhopalosiphum
                                                                        maidis
                                                                    </option>
                                                                    <option value="Rhopalosiphum_padi">Rhopalosiphum
                                                                        padi
                                                                    </option>
                                                                    <option value="Rhopilema_esculentum">Rhopilema
                                                                        esculentum
                                                                    </option>
                                                                    <option value="Ruditapes_philippinarum">Ruditapes
                                                                        philippinarum
                                                                    </option>
                                                                    <option value="Sabethes_cyaneus">Sabethes cyaneus
                                                                    </option>
                                                                    <option
                                                                        value="Saccoglossus_kowalevskii">Saccoglossus
                                                                        kowalevskii
                                                                    </option>
                                                                    <option value="Saccostrea_cuccullata">Saccostrea
                                                                        cuccullata
                                                                    </option>
                                                                    <option value="Saccostrea_echinata">Saccostrea
                                                                        echinata
                                                                    </option>
                                                                    <option value="Salpingoeca_rosetta">Salpingoeca
                                                                        rosetta
                                                                    </option>
                                                                    <option
                                                                        value="Scaptodrosophila_lebanonensis">Scaptodrosophila
                                                                        lebanonensis
                                                                    </option>
                                                                    <option value="Schistocerca_americana">Schistocerca
                                                                        americana
                                                                    </option>
                                                                    <option value="Schistocerca_cancellata">Schistocerca
                                                                        cancellata
                                                                    </option>
                                                                    <option value="Schistocerca_gregaria">Schistocerca
                                                                        gregaria
                                                                    </option>
                                                                    <option value="Schistocerca_nitens">Schistocerca
                                                                        nitens
                                                                    </option>
                                                                    <option value="Schistocerca_piceifrons">Schistocerca
                                                                        piceifrons
                                                                    </option>
                                                                    <option value="Schistocerca_serialis">Schistocerca
                                                                        serialis
                                                                    </option>
                                                                    <option value="Schistosoma_haematobium">Schistosoma
                                                                        haematobium
                                                                    </option>
                                                                    <option value="Schistosoma_mansoni">Schistosoma
                                                                        mansoni
                                                                    </option>
                                                                    <option value="Scylla_paramamosain">Scylla
                                                                        paramamosain
                                                                    </option>
                                                                    <option value="Sipha_flava">Sipha flava</option>
                                                                    <option value="Sitodiplosis_mosellana">Sitodiplosis
                                                                        mosellana
                                                                    </option>
                                                                    <option value="Sitophilus_oryzae">Sitophilus
                                                                        oryzae
                                                                    </option>
                                                                    <option value="Solenopsis_invicta">Solenopsis
                                                                        invicta
                                                                    </option>
                                                                    <option value="Sphaeroforma_arctica">Sphaeroforma
                                                                        arctica
                                                                    </option>
                                                                    <option value="Spodoptera_frugiperda">Spodoptera
                                                                        frugiperda
                                                                    </option>
                                                                    <option value="Spodoptera_litura">Spodoptera
                                                                        litura
                                                                    </option>
                                                                    <option value="Stegodyphus_dumicola">Stegodyphus
                                                                        dumicola
                                                                    </option>
                                                                    <option value="Stomoxys_calcitrans">Stomoxys
                                                                        calcitrans
                                                                    </option>
                                                                    <option
                                                                        value="Strongylocentrotus_purpuratus">Strongylocentrotus
                                                                        purpuratus
                                                                    </option>
                                                                    <option value="Strongyloides_ratti">Strongyloides
                                                                        ratti
                                                                    </option>
                                                                    <option value="Styela_clava">Styela clava</option>
                                                                    <option value="Stylophora_pistillata">Stylophora
                                                                        pistillata
                                                                    </option>
                                                                    <option value="Sycon_ciliatum">Sycon ciliatum
                                                                    </option>
                                                                    <option
                                                                        value="Symsagittifera_roscoffensis">Symsagittifera
                                                                        roscoffensis
                                                                    </option>
                                                                    <option value="Teleopsis_dalmanni">Teleopsis
                                                                        dalmanni
                                                                    </option>
                                                                    <option
                                                                        value="Temnothorax_curvispinosus">Temnothorax
                                                                        curvispinosus
                                                                    </option>
                                                                    <option value="Tenebrio_molitor">Tenebrio molitor
                                                                    </option>
                                                                    <option value="Tetranychus_urticae">Tetranychus
                                                                        urticae
                                                                    </option>
                                                                    <option value="Thrips_palmi">Thrips palmi</option>
                                                                    <option value="Tigriopus_californicus">Tigriopus
                                                                        californicus
                                                                    </option>
                                                                    <option value="Topomyia_yanbarensis">Topomyia
                                                                        yanbarensis
                                                                    </option>
                                                                    <option
                                                                        value="Toxorhynchites_rutilus">Toxorhynchites
                                                                        rutilus
                                                                    </option>
                                                                    <option value="Trachymyrmex_cornetzi">Trachymyrmex
                                                                        cornetzi
                                                                    </option>
                                                                    <option
                                                                        value="Trachymyrmex_septentrionalis">Trachymyrmex
                                                                        septentrionalis
                                                                    </option>
                                                                    <option value="Trachymyrmex_zeteki">Trachymyrmex
                                                                        zeteki
                                                                    </option>
                                                                    <option value="Tribolium_castaneum">Tribolium
                                                                        castaneum
                                                                    </option>
                                                                    <option value="Tribolium_madens">Tribolium madens
                                                                    </option>
                                                                    <option value="Trichinella_spiralis">Trichinella
                                                                        spiralis
                                                                    </option>
                                                                    <option value="Trichogramma_pretiosum">Trichogramma
                                                                        pretiosum
                                                                    </option>
                                                                    <option value="Trichoplax_adhaerens">Trichoplax
                                                                        adhaerens
                                                                    </option>
                                                                    <option value="Trichoplusia_ni">Trichoplusia ni
                                                                    </option>
                                                                    <option value="Uloborus_diversus">Uloborus
                                                                        diversus
                                                                    </option>
                                                                    <option value="Uranotaenia_lowii">Uranotaenia
                                                                        lowii
                                                                    </option>
                                                                    <option value="Vanessa_atalanta">Vanessa atalanta
                                                                    </option>
                                                                    <option value="Vanessa_cardui">Vanessa cardui
                                                                    </option>
                                                                    <option value="Vanessa_tameamea">Vanessa tameamea
                                                                    </option>
                                                                    <option value="Varroa_destructor">Varroa
                                                                        destructor
                                                                    </option>
                                                                    <option value="Varroa_jacobsoni">Varroa jacobsoni
                                                                    </option>
                                                                    <option value="Venturia_canescens">Venturia
                                                                        canescens
                                                                    </option>
                                                                    <option value="Vespa_crabro">Vespa crabro</option>
                                                                    <option value="Vespa_mandarinia">Vespa mandarinia
                                                                    </option>
                                                                    <option value="Vespa_velutina">Vespa velutina
                                                                    </option>
                                                                    <option value="Vespula_pensylvanica">Vespula
                                                                        pensylvanica
                                                                    </option>
                                                                    <option value="Vespula_vulgaris">Vespula vulgaris
                                                                    </option>
                                                                    <option value="Vollenhovia_emeryi">Vollenhovia
                                                                        emeryi
                                                                    </option>
                                                                    <option value="Wasmannia_auropunctata">Wasmannia
                                                                        auropunctata
                                                                    </option>
                                                                    <option value="Watersipora_subatra">Watersipora
                                                                        subatra
                                                                    </option>
                                                                    <option value="Wyeomyia_smithii">Wyeomyia smithii
                                                                    </option>
                                                                    <option value="Xenia_sp">Xenia sp</option>
                                                                    <option value="Ylistrum_balloti">Ylistrum balloti
                                                                    </option>
                                                                    <option value="Zerene_cesonia">Zerene cesonia
                                                                    </option>
                                                                    <option value="Zeugodacus_cucurbitae">Zeugodacus
                                                                        cucurbitae
                                                                    </option>
                                                                    <option value="Zootermopsis_nevadensis">Zootermopsis
                                                                        nevadensis
                                                                    </option>
                                                                    <option value="Zophobas_morio">Zophobas morio
                                                                    </option>
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "metagenomes" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="mine_drainage_metagenome">Mine
                                                                        Drainage Metagenome
                                                                    </option>
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "mitochondrion" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option
                                                                        value="mitochondrion.1.1.genomic.fna.gz">mitochondrion.1.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="mitochondrion.1.genomic.gbff.gz ">mitochondrion.1.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="mitochondrion.1.protein.faa.gz">mitochondrion.1.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="mitochondrion.1.protein.gpff.gz ">mitochondrion.1.protein.gpff.gz
                                                                    </option>


                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "plant" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option value="Abrus_precatorius">Abrus
                                                                        precatorius
                                                                    </option>
                                                                    <option value="Actinidia_eriantha">Actinidia
                                                                        eriantha
                                                                    </option>
                                                                    <option value="Aegilops_tauschii">Aegilops
                                                                        tauschii
                                                                    </option>
                                                                    <option value="Alnus_glutinosa">Alnus glutinosa
                                                                    </option>
                                                                    <option value="Amaranthus_tricolor">Amaranthus
                                                                        tricolor
                                                                    </option>
                                                                    <option value="Amborella_trichopoda">Amborella
                                                                        trichopoda
                                                                    </option>
                                                                    <option value="Ananas_comosus">Ananas comosus
                                                                    </option>
                                                                    <option value="Andrographis_paniculata">Andrographis
                                                                        paniculata
                                                                    </option>
                                                                    <option value="Arabidopsis_lyrata">Arabidopsis
                                                                        lyrata
                                                                    </option>
                                                                    <option value="Arabidopsis_thaliana">Arabidopsis
                                                                        thaliana
                                                                    </option>
                                                                    <option value="Arachis_duranensis">Arachis
                                                                        duranensis
                                                                    </option>
                                                                    <option value="Arachis_hypogaea">Arachis hypogaea
                                                                    </option>
                                                                    <option value="Arachis_ipaensis">Arachis ipaensis
                                                                    </option>
                                                                    <option value="Arachis_stenosperma">Arachis
                                                                        stenosperma
                                                                    </option>
                                                                    <option value="Argentina_anserina">Argentina
                                                                        anserina
                                                                    </option>
                                                                    <option
                                                                        value="Aristolochia_californica">Aristolochia
                                                                        californica
                                                                    </option>
                                                                    <option value="Asparagus_officinalis">Asparagus
                                                                        officinalis
                                                                    </option>
                                                                    <option
                                                                        value="Auxenochlorella_protothecoides">Auxenochlorella
                                                                        protothecoides
                                                                    </option>
                                                                    <option value="Bathycoccus_prasinos">Bathycoccus
                                                                        prasinos
                                                                    </option>
                                                                    <option value="Benincasa_hispida">Benincasa
                                                                        hispida
                                                                    </option>
                                                                    <option value="Beta_vulgaris">Beta vulgaris</option>
                                                                    <option value="Brachypodium_distachyon">Brachypodium
                                                                        distachyon
                                                                    </option>
                                                                    <option value="Brassica_napus">Brassica napus
                                                                    </option>
                                                                    <option value="Brassica_oleracea">Brassica
                                                                        oleracea
                                                                    </option>
                                                                    <option value="Brassica_rapa">Brassica rapa</option>
                                                                    <option value="Cajanus_cajan">Cajanus cajan</option>
                                                                    <option value="Camelina_sativa">Camelina sativa
                                                                    </option>
                                                                    <option value="Camellia_sinensis">Camellia
                                                                        sinensis
                                                                    </option>
                                                                    <option value="Cannabis_sativa">Cannabis sativa
                                                                    </option>
                                                                    <option value="Capsella_rubella">Capsella rubella
                                                                    </option>
                                                                    <option value="Capsicum_annuum">Capsicum annuum
                                                                    </option>
                                                                    <option value="Carica_papaya">Carica papaya</option>
                                                                    <option value="Carya_illinoinensis">Carya
                                                                        illinoinensis
                                                                    </option>
                                                                    <option value="Chenopodium_quinoa">Chenopodium
                                                                        quinoa
                                                                    </option>
                                                                    <option
                                                                        value="Chlamydomonas_reinhardtii">Chlamydomonas
                                                                        reinhardtii
                                                                    </option>
                                                                    <option value="Chlorella_variabilis">Chlorella
                                                                        variabilis
                                                                    </option>
                                                                    <option value="Chondrus_crispus">Chondrus crispus
                                                                    </option>
                                                                    <option value="Cicer_arietinum">Cicer arietinum
                                                                    </option>
                                                                    <option value="Citrus_sinensis">Citrus sinensis
                                                                    </option>
                                                                    <option value="Citrus_x_clementina">Citrus x
                                                                        clementina
                                                                    </option>
                                                                    <option value="Coccomyxa_subellipsoidea">Coccomyxa
                                                                        subellipsoidea
                                                                    </option>
                                                                    <option value="Coffea_arabica">Coffea arabica
                                                                    </option>
                                                                    <option value="Coffea_eugenioides">Coffea
                                                                        eugenioides
                                                                    </option>
                                                                    <option value="Cornus_florida">Cornus florida
                                                                    </option>
                                                                    <option value="Corylus_avellana">Corylus avellana
                                                                    </option>
                                                                    <option value="Cryptomeria_japonica">Cryptomeria
                                                                        japonica
                                                                    </option>
                                                                    <option value="Cucumis_melo">Cucumis melo</option>
                                                                    <option value="Cucumis_sativus">Cucumis sativus
                                                                    </option>
                                                                    <option value="Cucurbita_maxima">Cucurbita maxima
                                                                    </option>
                                                                    <option value="Cucurbita_moschata">Cucurbita
                                                                        moschata
                                                                    </option>
                                                                    <option value="Cucurbita_pepo">Cucurbita pepo
                                                                    </option>
                                                                    <option
                                                                        value="Cyanidioschyzon_merolae">Cyanidioschyzon
                                                                        merolae
                                                                    </option>
                                                                    <option value="Cynara_cardunculus">Cynara
                                                                        cardunculus
                                                                    </option>
                                                                    <option value="Daucus_carota">Daucus carota</option>
                                                                    <option value="Dendrobium_catenatum">Dendrobium
                                                                        catenatum
                                                                    </option>
                                                                    <option value="Dendrobium_officinale">Dendrobium
                                                                        officinale
                                                                    </option>
                                                                    <option value="Dioscorea_cayenensis">Dioscorea
                                                                        cayenensis
                                                                    </option>
                                                                    <option value="Diospyros_lotus">Diospyros lotus
                                                                    </option>
                                                                    <option value="Durio_zibethinus">Durio zibethinus
                                                                    </option>
                                                                    <option value="Elaeis_guineensis">Elaeis
                                                                        guineensis
                                                                    </option>
                                                                    <option value="Erigeron_canadensis">Erigeron
                                                                        canadensis
                                                                    </option>
                                                                    <option value="Erythranthe_guttata">Erythranthe
                                                                        guttata
                                                                    </option>
                                                                    <option value="Eucalyptus_grandis">Eucalyptus
                                                                        grandis
                                                                    </option>
                                                                    <option value="Euphorbia_lathyris">Euphorbia
                                                                        lathyris
                                                                    </option>
                                                                    <option value="Eutrema_salsugineum">Eutrema
                                                                        salsugineum
                                                                    </option>
                                                                    <option value="Fragaria_vesca">Fragaria vesca
                                                                    </option>
                                                                    <option value="Galdieria_sulphuraria">Galdieria
                                                                        sulphuraria
                                                                    </option>
                                                                    <option value="Gastrolobium_bilobum">Gastrolobium
                                                                        bilobum
                                                                    </option>
                                                                    <option value="Glycine_max">Glycine max</option>
                                                                    <option value="Glycine_soja">Glycine soja</option>
                                                                    <option value="Gossypium_arboreum">Gossypium
                                                                        arboreum
                                                                    </option>
                                                                    <option value="Gossypium_hirsutum">Gossypium
                                                                        hirsutum
                                                                    </option>
                                                                    <option value="Gossypium_raimondii">Gossypium
                                                                        raimondii
                                                                    </option>
                                                                    <option value="Helianthus_annuus">Helianthus
                                                                        annuus
                                                                    </option>
                                                                    <option value="Herrania_umbratica">Herrania
                                                                        umbratica
                                                                    </option>
                                                                    <option value="Hevea_brasiliensis">Hevea
                                                                        brasiliensis
                                                                    </option>
                                                                    <option value="Hibiscus_syriacus">Hibiscus
                                                                        syriacus
                                                                    </option>
                                                                    <option value="Hordeum_vulgare">Hordeum vulgare
                                                                    </option>
                                                                    <option value="Humulus_lupulus">Humulus lupulus
                                                                    </option>
                                                                    <option value="Impatiens_glandulifera">Impatiens
                                                                        glandulifera
                                                                    </option>
                                                                    <option value="Ipomoea_nil">Ipomoea nil</option>
                                                                    <option value="Ipomoea_triloba">Ipomoea triloba
                                                                    </option>
                                                                    <option value="Jatropha_curcas">Jatropha curcas
                                                                    </option>
                                                                    <option
                                                                        value="Juglans_microcarpa_x_Juglans_regia">Juglans
                                                                        microcarpa x Juglans regia
                                                                    </option>
                                                                    <option value="Juglans_regia">Juglans regia</option>
                                                                    <option value="Lactuca_sativa">Lactuca sativa
                                                                    </option>
                                                                    <option value="Lolium_perenne">Lolium perenne
                                                                    </option>
                                                                    <option value="Lolium_rigidum">Lolium rigidum
                                                                    </option>
                                                                    <option value="Lotus_japonicus">Lotus japonicus
                                                                    </option>
                                                                    <option value="Lupinus_angustifolius">Lupinus
                                                                        angustifolius
                                                                    </option>
                                                                    <option value="Lycium_barbarum">Lycium barbarum
                                                                    </option>
                                                                    <option value="Lycium_ferocissimum">Lycium
                                                                        ferocissimum
                                                                    </option>
                                                                    <option value="Macadamia_integrifolia">Macadamia
                                                                        integrifolia
                                                                    </option>
                                                                    <option value="Magnolia_sinica">Magnolia sinica
                                                                    </option>
                                                                    <option value="Malania_oleifera">Malania oleifera
                                                                    </option>
                                                                    <option value="Malus_domestica">Malus domestica
                                                                    </option>
                                                                    <option value="Malus_sylvestris">Malus sylvestris
                                                                    </option>
                                                                    <option value="Mangifera_indica">Mangifera indica
                                                                    </option>
                                                                    <option value="Manihot_esculenta">Manihot
                                                                        esculenta
                                                                    </option>
                                                                    <option value="Medicago_truncatula">Medicago
                                                                        truncatula
                                                                    </option>
                                                                    <option value="Mercurialis_annua">Mercurialis
                                                                        annua
                                                                    </option>
                                                                    <option value="Micromonas_commoda">Micromonas
                                                                        commoda
                                                                    </option>
                                                                    <option value="Micromonas_pusilla">Micromonas
                                                                        pusilla
                                                                    </option>
                                                                    <option value="Miscanthus_floridulus">Miscanthus
                                                                        floridulus
                                                                    </option>
                                                                    <option value="Momordica_charantia">Momordica
                                                                        charantia
                                                                    </option>
                                                                    <option
                                                                        value="Monoraphidium_neglectum">Monoraphidium
                                                                        neglectum
                                                                    </option>
                                                                    <option value="Morus_notabilis">Morus notabilis
                                                                    </option>
                                                                    <option value="Musa_acuminata">Musa acuminata
                                                                    </option>
                                                                    <option value="Nelumbo_nucifera">Nelumbo nucifera
                                                                    </option>
                                                                    <option value="Nicotiana_attenuata">Nicotiana
                                                                        attenuata
                                                                    </option>
                                                                    <option value="Nicotiana_sylvestris">Nicotiana
                                                                        sylvestris
                                                                    </option>
                                                                    <option value="Nicotiana_tabacum">Nicotiana
                                                                        tabacum
                                                                    </option>
                                                                    <option value="Nicotiana_tomentosiformis">Nicotiana
                                                                        tomentosiformis
                                                                    </option>
                                                                    <option value="Nymphaea_colorata">Nymphaea
                                                                        colorata
                                                                    </option>
                                                                    <option value="Olea_europaea">Olea europaea</option>
                                                                    <option value="Oryza_brachyantha">Oryza
                                                                        brachyantha
                                                                    </option>
                                                                    <option value="Oryza_glaberrima">Oryza glaberrima
                                                                    </option>
                                                                    <option value="Oryza_sativa">Oryza sativa</option>
                                                                    <option value="Ostreococcus_sp">Ostreococcus sp
                                                                    </option>
                                                                    <option value="Ostreococcus_tauri">Ostreococcus
                                                                        tauri
                                                                    </option>
                                                                    <option value="Panicum_hallii">Panicum hallii
                                                                    </option>
                                                                    <option value="Panicum_virgatum">Panicum virgatum
                                                                    </option>
                                                                    <option value="Papaver_somniferum">Papaver
                                                                        somniferum
                                                                    </option>
                                                                    <option value="Phalaenopsis_equestris">Phalaenopsis
                                                                        equestris
                                                                    </option>
                                                                    <option value="Phaseolus_vulgaris">Phaseolus
                                                                        vulgaris
                                                                    </option>
                                                                    <option value="Phoenix_dactylifera">Phoenix
                                                                        dactylifera
                                                                    </option>
                                                                    <option value="Phragmites_australis">Phragmites
                                                                        australis
                                                                    </option>
                                                                    <option value="Physcomitrium_patens">Physcomitrium
                                                                        patens
                                                                    </option>
                                                                    <option value="Pistacia_vera">Pistacia vera</option>
                                                                    <option value="Pisum_sativum">Pisum sativum</option>
                                                                    <option value="Populus_alba">Populus alba</option>
                                                                    <option value="Populus_euphratica">Populus
                                                                        euphratica
                                                                    </option>
                                                                    <option value="Populus_nigra">Populus nigra</option>
                                                                    <option value="Populus_trichocarpa">Populus
                                                                        trichocarpa
                                                                    </option>
                                                                    <option value="Prosopis_alba">Prosopis alba</option>
                                                                    <option value="Prosopis_cineraria">Prosopis
                                                                        cineraria
                                                                    </option>
                                                                    <option value="Prunus_avium">Prunus avium</option>
                                                                    <option value="Prunus_dulcis">Prunus dulcis</option>
                                                                    <option value="Prunus_mume">Prunus mume</option>
                                                                    <option value="Prunus_persica">Prunus persica
                                                                    </option>
                                                                    <option value="Punica_granatum">Punica granatum
                                                                    </option>
                                                                    <option value="Pyrus_communis">Pyrus communis
                                                                    </option>
                                                                    <option value="Pyrus_x_bretschneideri">Pyrus x
                                                                        bretschneideri
                                                                    </option>
                                                                    <option value="Quercus_lobata">Quercus lobata
                                                                    </option>
                                                                    <option value="Quercus_robur">Quercus robur</option>
                                                                    <option value="Quercus_suber">Quercus suber</option>
                                                                    <option value="Raphanus_sativus">Raphanus sativus
                                                                    </option>
                                                                    <option value="Rhodamnia_argentea">Rhodamnia
                                                                        argentea
                                                                    </option>
                                                                    <option value="Rhododendron_vialii">Rhododendron
                                                                        vialii
                                                                    </option>
                                                                    <option value="Ricinus_communis">Ricinus communis
                                                                    </option>
                                                                    <option value="Rosa_chinensis">Rosa chinensis
                                                                    </option>
                                                                    <option value="Rosa_rugosa">Rosa rugosa</option>
                                                                    <option value="Salvia_hispanica">Salvia hispanica
                                                                    </option>
                                                                    <option value="Salvia_miltiorrhiza">Salvia
                                                                        miltiorrhiza
                                                                    </option>
                                                                    <option value="Salvia_splendens">Salvia splendens
                                                                    </option>
                                                                    <option
                                                                        value="Selaginella_moellendorffii">Selaginella
                                                                        moellendorffii
                                                                    </option>
                                                                    <option value="Sesamum_indicum">Sesamum indicum
                                                                    </option>
                                                                    <option value="Setaria_italica">Setaria italica
                                                                    </option>
                                                                    <option value="Setaria_viridis">Setaria viridis
                                                                    </option>
                                                                    <option value="Solanum_dulcamara">Solanum
                                                                        dulcamara
                                                                    </option>
                                                                    <option value="Solanum_lycopersicum">Solanum
                                                                        lycopersicum
                                                                    </option>
                                                                    <option value="Solanum_pennellii">Solanum
                                                                        pennellii
                                                                    </option>
                                                                    <option value="Solanum_stenotomum">Solanum
                                                                        stenotomum
                                                                    </option>
                                                                    <option value="Solanum_tuberosum">Solanum
                                                                        tuberosum
                                                                    </option>
                                                                    <option value="Solanum_verrucosum">Solanum
                                                                        verrucosum
                                                                    </option>
                                                                    <option value="Sorghum_bicolor">Sorghum bicolor
                                                                    </option>
                                                                    <option value="Spinacia_oleracea">Spinacia
                                                                        oleracea
                                                                    </option>
                                                                    <option value="Syzygium_oleosum">Syzygium oleosum
                                                                    </option>
                                                                    <option value="Tarenaya_hassleriana">Tarenaya
                                                                        hassleriana
                                                                    </option>
                                                                    <option value="Telopea_speciosissima">Telopea
                                                                        speciosissima
                                                                    </option>
                                                                    <option value="Theobroma_cacao">Theobroma cacao
                                                                    </option>
                                                                    <option value="Trifolium_pratense">Trifolium
                                                                        pratense
                                                                    </option>
                                                                    <option value="Tripterygium_wilfordii">Tripterygium
                                                                        wilfordii
                                                                    </option>
                                                                    <option value="Triticum_aestivum">Triticum
                                                                        aestivum
                                                                    </option>
                                                                    <option value="Triticum_dicoccoides">Triticum
                                                                        dicoccoides
                                                                    </option>
                                                                    <option value="Triticum_urartu">Triticum urartu
                                                                    </option>
                                                                    <option value="Vicia_villosa">Vicia villosa</option>
                                                                    <option value="Vigna_angularis">Vigna angularis
                                                                    </option>
                                                                    <option value="Vigna_radiata">Vigna radiata</option>
                                                                    <option value="Vigna_umbellata">Vigna umbellata
                                                                    </option>
                                                                    <option value="Vigna_unguiculata">Vigna
                                                                        unguiculata
                                                                    </option>
                                                                    <option value="Vitis_riparia">Vitis riparia</option>
                                                                    <option value="Vitis_vinifera">Vitis vinifera
                                                                    </option>
                                                                    <option value="Volvox_carteri">Volvox carteri
                                                                    </option>
                                                                    <option value="Zea_mays">Zea mays</option>
                                                                    <option value="Zingiber_officinale">Zingiber
                                                                        officinale
                                                                    </option>
                                                                    <option value="Ziziphus_jujuba">Ziziphus jujuba
                                                                    </option>

                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "plasmid" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option
                                                                        value="plasmid.1.1.genomic.fna.gz">plasmid.1.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.1.2.genomic.fna.gz">plasmid.1.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.1.genomic.gbff.gz">plasmid.1.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.1.protein.faa.gz">plasmid.1.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.1.protein.gpff.gz">plasmid.1.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.1.rna.fna.gz">plasmid.1.rna.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.1.rna.gbff.gz">plasmid.1.rna.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.2.1.genomic.fna.gz">plasmid.2.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.2.2.genomic.fna.gz">plasmid.2.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.2.genomic.gbff.gz">plasmid.2.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.3.1.genomic.fna.gz">plasmid.3.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.3.2.genomic.fna.gz">plasmid.3.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.3.genomic.gbff.gz">plasmid.3.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.3.protein.faa.gz">plasmid.3.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.3.protein.gpff.gz">plasmid.3.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.4.1.genomic.fna.gz">plasmid.4.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.4.2.genomic.fna.gz">plasmid.4.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.4.genomic.gbff.gz">plasmid.4.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.5.1.genomic.fna.gz">plasmid.5.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.5.2.genomic.fna.gz">plasmid.5.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.5.genomic.gbff.gz">plasmid.5.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.6.1.genomic.fna.gz">plasmid.6.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.6.2.genomic.fna.gz">plasmid.6.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.6.genomic.gbff.gz">plasmid.6.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.6.protein.faa.gz">plasmid.6.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.6.protein.gpff.gz">plasmid.6.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.7.1.genomic.fna.gz">plasmid.7.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.7.genomic.gbff.gz">plasmid.7.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.7.protein.faa.gz">plasmid.7.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.7.protein.gpff.gz">plasmid.7.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wgs_mstr.gbff.gz">plasmid.wgs_mstr.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.1.protein.faa.gz">plasmid.wp_protein.1.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.1.protein.gpff.gz">plasmid.wp_protein.1.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.2.protein.faa.gz">plasmid.wp_protein.2.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.2.protein.gpff.gz">plasmid.wp_protein.2.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.3.protein.faa.gz">plasmid.wp_protein.3.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.3.protein.gpff.gz">plasmid.wp_protein.3.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.4.protein.faa.gz">plasmid.wp_protein.4.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.4.protein.gpff.gz">plasmid.wp_protein.4.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.5.protein.faa.gz">plasmid.wp_protein.5.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plasmid.wp_protein.5.protein.gpff.gz">plasmid.wp_protein.5.protein.gpff.gz
                                                                    </option>
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "plastid" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option
                                                                        value="plastid.1.1.genomic.fna.gz">plastid.1.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.1.genomic.gbff.gz">plastid.1.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.1.protein.faa.gz">plastid.1.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.1.protein.gpff.gz">plastid.1.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.2.1.genomic.fna.gz">plastid.2.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.2.2.genomic.fna.gz">plastid.2.2.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.2.genomic.gbff.gz">plastid.2.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.2.protein.faa.gz">plastid.2.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.2.protein.gpff.gz">plastid.2.protein.gpff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.3.1.genomic.fna.gz">plastid.3.1.genomic.fna.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.3.genomic.gbff.gz">plastid.3.genomic.gbff.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.3.protein.faa.gz">plastid.3.protein.faa.gz
                                                                    </option>
                                                                    <option
                                                                        value="plastid.3.protein.gpff.gz">plastid.3.protein.gpff.gz
                                                                    </option>
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "protozoa" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="">Select a species</option>
                                                                    <option
                                                                        value="Acanthamoeba_castellanii">Acanthamoeba
                                                                        castellanii
                                                                    </option>
                                                                    <option
                                                                        value="Acytostelium_subglobosum">Acytostelium
                                                                        subglobosum
                                                                    </option>
                                                                    <option value="Aphanomyces_astaci">Aphanomyces
                                                                        astaci
                                                                    </option>
                                                                    <option value="Aphanomyces_invadans">Aphanomyces
                                                                        invadans
                                                                    </option>
                                                                    <option
                                                                        value="Aureococcus_anophagefferens">Aureococcus
                                                                        anophagefferens
                                                                    </option>
                                                                    <option value="Babesia_bigemina">Babesia bigemina
                                                                    </option>
                                                                    <option value="Babesia_bovis">Babesia bovis</option>
                                                                    <option value="Babesia_caballi">Babesia caballi
                                                                    </option>
                                                                    <option value="Babesia_duncani">Babesia duncani
                                                                    </option>
                                                                    <option value="Babesia_microti">Babesia microti
                                                                    </option>
                                                                    <option value="Babesia_ovata">Babesia ovata</option>
                                                                    <option value="Babesia_sp">Babesia sp</option>
                                                                    <option value="Besnoitia_besnoiti">Besnoitia
                                                                        besnoiti
                                                                    </option>
                                                                    <option value="Bigelowiella_natans">Bigelowiella
                                                                        natans
                                                                    </option>
                                                                    <option value="Blastocystis_hominis">Blastocystis
                                                                        hominis
                                                                    </option>
                                                                    <option value="Blastocystis_sp">Blastocystis sp
                                                                    </option>
                                                                    <option value="Bremia_lactucae">Bremia lactucae
                                                                    </option>
                                                                    <option value="Cavenderia_fasciculata">Cavenderia
                                                                        fasciculata
                                                                    </option>
                                                                    <option value="Cryptomonas_paramecium">Cryptomonas
                                                                        paramecium
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_andersoni">Cryptosporidium
                                                                        andersoni
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_bovis">Cryptosporidium
                                                                        bovis
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_hominis">Cryptosporidium
                                                                        hominis
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_muris">Cryptosporidium
                                                                        muris
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_parvum">Cryptosporidium
                                                                        parvum
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_ryanae">Cryptosporidium
                                                                        ryanae
                                                                    </option>
                                                                    <option value="Cryptosporidium_sp">Cryptosporidium
                                                                        sp
                                                                    </option>
                                                                    <option
                                                                        value="Cryptosporidium_ubiquitum">Cryptosporidium
                                                                        ubiquitum
                                                                    </option>
                                                                    <option value="Cyclospora_cayetanensis">Cyclospora
                                                                        cayetanensis
                                                                    </option>
                                                                    <option value="Cystoisospora_suis">Cystoisospora
                                                                        suis
                                                                    </option>
                                                                    <option
                                                                        value="Dictyostelium_discoideum">Dictyostelium
                                                                        discoideum
                                                                    </option>
                                                                    <option
                                                                        value="Dictyostelium_purpureum">Dictyostelium
                                                                        purpureum
                                                                    </option>
                                                                    <option value="Eimeria_acervulina">Eimeria
                                                                        acervulina
                                                                    </option>
                                                                    <option value="Eimeria_maxima">Eimeria maxima
                                                                    </option>
                                                                    <option value="Eimeria_mitis">Eimeria mitis</option>
                                                                    <option value="Eimeria_necatrix">Eimeria necatrix
                                                                    </option>
                                                                    <option value="Eimeria_tenella">Eimeria tenella
                                                                    </option>
                                                                    <option value="Emiliania_huxleyi">Emiliania
                                                                        huxleyi
                                                                    </option>
                                                                    <option value="Entamoeba_dispar">Entamoeba dispar
                                                                    </option>
                                                                    <option value="Entamoeba_histolytica">Entamoeba
                                                                        histolytica
                                                                    </option>
                                                                    <option value="Entamoeba_invadens">Entamoeba
                                                                        invadens
                                                                    </option>
                                                                    <option value="Entamoeba_nuttalli">Entamoeba
                                                                        nuttalli
                                                                    </option>
                                                                    <option value="Giardia_intestinalis">Giardia
                                                                        intestinalis
                                                                    </option>
                                                                    <option value="Gregarina_niphandrodes">Gregarina
                                                                        niphandrodes
                                                                    </option>
                                                                    <option value="Guillardia_theta">Guillardia theta
                                                                    </option>
                                                                    <option value="Hammondia_hammondi">Hammondia
                                                                        hammondi
                                                                    </option>
                                                                    <option value="Hemiselmis_andersenii">Hemiselmis
                                                                        andersenii
                                                                    </option>
                                                                    <option value="Heterostelium_album">Heterostelium
                                                                        album
                                                                    </option>
                                                                    <option value="Histomonas_meleagridis">Histomonas
                                                                        meleagridis
                                                                    </option>
                                                                    <option
                                                                        value="Ichthyophthirius_multifiliis">Ichthyophthirius
                                                                        multifiliis
                                                                    </option>
                                                                    <option value="Leishmania_braziliensis">Leishmania
                                                                        braziliensis
                                                                    </option>
                                                                    <option value="Leishmania_donovani">Leishmania
                                                                        donovani
                                                                    </option>
                                                                    <option value="Leishmania_enriettii">Leishmania
                                                                        enriettii
                                                                    </option>
                                                                    <option value="Leishmania_infantum">Leishmania
                                                                        infantum
                                                                    </option>
                                                                    <option value="Leishmania_major">Leishmania major
                                                                    </option>
                                                                    <option value="Leishmania_martiniquensis">Leishmania
                                                                        martiniquensis
                                                                    </option>
                                                                    <option value="Leishmania_mexicana">Leishmania
                                                                        mexicana
                                                                    </option>
                                                                    <option value="Leishmania_orientalis">Leishmania
                                                                        orientalis
                                                                    </option>
                                                                    <option value="Leishmania_panamensis">Leishmania
                                                                        panamensis
                                                                    </option>
                                                                    <option value="Leishmania_sp">Leishmania sp</option>
                                                                    <option value="Leishmania_sp">Leishmania sp</option>
                                                                    <option value="Leptomonas_pyrrhocoris">Leptomonas
                                                                        pyrrhocoris
                                                                    </option>
                                                                    <option
                                                                        value="Monocercomonoides_exilis">Monocercomonoides
                                                                        exilis
                                                                    </option>
                                                                    <option value="Naegleria_fowleri">Naegleria
                                                                        fowleri
                                                                    </option>
                                                                    <option value="Naegleria_gruberi">Naegleria
                                                                        gruberi
                                                                    </option>
                                                                    <option value="Naegleria_lovaniensis">Naegleria
                                                                        lovaniensis
                                                                    </option>
                                                                    <option
                                                                        value="Nannochloropsis_gaditana">Nannochloropsis
                                                                        gaditana
                                                                    </option>
                                                                    <option value="Neospora_caninum">Neospora caninum
                                                                    </option>
                                                                    <option value="Paramecium_tetraurelia">Paramecium
                                                                        tetraurelia
                                                                    </option>
                                                                    <option value="Perkinsus_marinus">Perkinsus
                                                                        marinus
                                                                    </option>
                                                                    <option
                                                                        value="Phaeodactylum_tricornutum">Phaeodactylum
                                                                        tricornutum
                                                                    </option>
                                                                    <option value="Phytophthora_cinnamomi">Phytophthora
                                                                        cinnamomi
                                                                    </option>
                                                                    <option value="Phytophthora_infestans">Phytophthora
                                                                        infestans
                                                                    </option>
                                                                    <option value="Phytophthora_nicotianae">Phytophthora
                                                                        nicotianae
                                                                    </option>
                                                                    <option value="Phytophthora_ramorum">Phytophthora
                                                                        ramorum
                                                                    </option>
                                                                    <option value="Phytophthora_sojae">Phytophthora
                                                                        sojae
                                                                    </option>
                                                                    <option value="Plasmodium_berghei">Plasmodium
                                                                        berghei
                                                                    </option>
                                                                    <option value="Plasmodium_brasilianum">Plasmodium
                                                                        brasilianum
                                                                    </option>
                                                                    <option value="Plasmodium_chabaudi">Plasmodium
                                                                        chabaudi
                                                                    </option>
                                                                    <option value="Plasmodium_coatneyi">Plasmodium
                                                                        coatneyi
                                                                    </option>
                                                                    <option value="Plasmodium_cynomolgi">Plasmodium
                                                                        cynomolgi
                                                                    </option>
                                                                    <option value="Plasmodium_falciparum">Plasmodium
                                                                        falciparum
                                                                    </option>
                                                                    <option value="Plasmodium_fragile">Plasmodium
                                                                        fragile
                                                                    </option>
                                                                    <option value="Plasmodium_gaboni">Plasmodium
                                                                        gaboni
                                                                    </option>
                                                                    <option value="Plasmodium_gallinaceum">Plasmodium
                                                                        gallinaceum
                                                                    </option>
                                                                    <option value="Plasmodium_gonderi">Plasmodium
                                                                        gonderi
                                                                    </option>
                                                                    <option value="Plasmodium_inui">Plasmodium inui
                                                                    </option>
                                                                    <option value="Plasmodium_knowlesi">Plasmodium
                                                                        knowlesi
                                                                    </option>
                                                                    <option value="Plasmodium_malariae">Plasmodium
                                                                        malariae
                                                                    </option>
                                                                    <option value="Plasmodium_reichenowi">Plasmodium
                                                                        reichenowi
                                                                    </option>
                                                                    <option value="Plasmodium_relictum">Plasmodium
                                                                        relictum
                                                                    </option>
                                                                    <option value="Plasmodium_sp">Plasmodium sp</option>
                                                                    <option value="Plasmodium_vinckei">Plasmodium
                                                                        vinckei
                                                                    </option>
                                                                    <option value="Plasmodium_vivax">Plasmodium vivax
                                                                    </option>
                                                                    <option value="Plasmodium_yoelii">Plasmodium
                                                                        yoelii
                                                                    </option>
                                                                    <option value="Plasmopara_halstedii">Plasmopara
                                                                        halstedii
                                                                    </option>
                                                                    <option value="Porcisia_hertigi">Porcisia hertigi
                                                                    </option>
                                                                    <option value="Porospora_cf">Porospora cf</option>
                                                                    <option value="Porospora_cf">Porospora cf</option>
                                                                    <option value="Saprolegnia_diclina">Saprolegnia
                                                                        diclina
                                                                    </option>
                                                                    <option value="Saprolegnia_parasitica">Saprolegnia
                                                                        parasitica
                                                                    </option>
                                                                    <option
                                                                        value="Spironucleus_salmonicida">Spironucleus
                                                                        salmonicida
                                                                    </option>
                                                                    <option value="Tetrahymena_thermophila">Tetrahymena
                                                                        thermophila
                                                                    </option>
                                                                    <option
                                                                        value="Thalassiosira_pseudonana">Thalassiosira
                                                                        pseudonana
                                                                    </option>
                                                                    <option value="Thecamonas_trahens">Thecamonas
                                                                        trahens
                                                                    </option>
                                                                    <option value="Theileria_annulata">Theileria
                                                                        annulata
                                                                    </option>
                                                                    <option value="Theileria_equi">Theileria equi
                                                                    </option>
                                                                    <option value="Theileria_orientalis">Theileria
                                                                        orientalis
                                                                    </option>
                                                                    <option value="Theileria_parva">Theileria parva
                                                                    </option>
                                                                    <option value="Toxoplasma_gondii">Toxoplasma
                                                                        gondii
                                                                    </option>
                                                                    <option value="Trichomonas_vaginalis">Trichomonas
                                                                        vaginalis
                                                                    </option>
                                                                    <option value="Tritrichomonas_foetus">Tritrichomonas
                                                                        foetus
                                                                    </option>
                                                                    <option value="Trypanosoma_brucei">Trypanosoma
                                                                        brucei
                                                                    </option>
                                                                    <option value="Trypanosoma_conorhini">Trypanosoma
                                                                        conorhini
                                                                    </option>
                                                                    <option value="Trypanosoma_cruzi">Trypanosoma
                                                                        cruzi
                                                                    </option>
                                                                    <option value="Trypanosoma_equiperdum">Trypanosoma
                                                                        equiperdum
                                                                    </option>
                                                                    <option value="Trypanosoma_grayi">Trypanosoma
                                                                        grayi
                                                                    </option>
                                                                    <option value="Trypanosoma_melophagium">Trypanosoma
                                                                        melophagium
                                                                    </option>
                                                                    <option value="Trypanosoma_rangeli">Trypanosoma
                                                                        rangeli
                                                                    </option>
                                                                    <option value="Trypanosoma_theileri">Trypanosoma
                                                                        theileri
                                                                    </option>
                                                                </select>


                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "unknown" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={formDataNcbi.source_params.species.value}
                                                                    onChange={handleChange}
                                                                >
                                                                    <option value="taxid_0/">taxid_0/</option>
                                                                </select>

                                                            </>
                                                        ) : formDataNcbi.source_params.taxon.value === "vertebrate_other" ? (
                                                                <>
                                                                    <select
                                                                        className="form-control"
                                                                        id="species"
                                                                        value={formDataNcbi.source_params.species.value}
                                                                        onChange={handleChange}
                                                                    >
                                                                        <option value="">Select a species</option>
                                                                        <option
                                                                            value="YAcanthisitta_chloris">YAcanthisitta
                                                                            chloris
                                                                        </option>
                                                                        <option
                                                                            value="Acanthochromis_polyacanthus">Acanthochromis
                                                                            polyacanthus
                                                                        </option>
                                                                        <option
                                                                            value="Acanthopagrus_latus">Acanthopagrus
                                                                            latus
                                                                        </option>
                                                                        <option value="Accipiter_gentilis">Accipiter
                                                                            gentilis
                                                                        </option>
                                                                        <option value="Acipenser_ruthenus">Acipenser
                                                                            ruthenus
                                                                        </option>
                                                                        <option value="Agelaius_phoeniceus">Agelaius
                                                                            phoeniceus
                                                                        </option>
                                                                        <option value="Agelaius_tricolor">Agelaius
                                                                            tricolor
                                                                        </option>
                                                                        <option value="Ahaetulla_prasina">Ahaetulla
                                                                            prasina
                                                                        </option>
                                                                        <option
                                                                            value="Alligator_mississippiensis">Alligator
                                                                            mississippiensis
                                                                        </option>
                                                                        <option value="Alligator_sinensis">Alligator
                                                                            sinensis
                                                                        </option>
                                                                        <option value="Alosa_alosa">Alosa alosa</option>
                                                                        <option value="Alosa_sapidissima">Alosa
                                                                            sapidissima
                                                                        </option>
                                                                        <option value="Amblyraja_radiata">Amblyraja
                                                                            radiata
                                                                        </option>
                                                                        <option value="Ambystoma_mexicanum">Ambystoma
                                                                            mexicanum
                                                                        </option>
                                                                        <option value="Amia_calva">Amia calva</option>
                                                                        <option value="Ammospiza_caudacuta">Ammospiza
                                                                            caudacuta
                                                                        </option>
                                                                        <option value="Ammospiza_nelsoni">Ammospiza
                                                                            nelsoni
                                                                        </option>
                                                                        <option value="Amphiprion_ocellaris">Amphiprion
                                                                            ocellaris
                                                                        </option>
                                                                        <option value="Anabas_testudineus">Anabas
                                                                            testudineus
                                                                        </option>
                                                                        <option
                                                                            value="Anarrhichthys_ocellatus">Anarrhichthys
                                                                            ocellatus
                                                                        </option>
                                                                        <option value="Anas_acuta">Anas acuta</option>
                                                                        <option value="Anas_platyrhynchos">Anas
                                                                            platyrhynchos
                                                                        </option>
                                                                        <option value="Anguilla_anguilla">Anguilla
                                                                            anguilla
                                                                        </option>
                                                                        <option value="Anguilla_rostrata">Anguilla
                                                                            rostrata
                                                                        </option>
                                                                        <option value="Anolis_carolinensis">Anolis
                                                                            carolinensis
                                                                        </option>
                                                                        <option value="Anolis_sagrei">Anolis sagrei
                                                                        </option>
                                                                        <option
                                                                            value="Anomalospiza_imberbis">Anomalospiza
                                                                            imberbis
                                                                        </option>
                                                                        <option value="Anoplopoma_fimbria">Anoplopoma
                                                                            fimbria
                                                                        </option>
                                                                        <option value="Anser_cygnoides">Anser
                                                                            cygnoides
                                                                        </option>
                                                                        <option value="Antennarius_striatus">Antennarius
                                                                            striatus
                                                                        </option>
                                                                        <option
                                                                            value="Antrostomus_carolinensis">Antrostomus
                                                                            carolinensis
                                                                        </option>
                                                                        <option value="Apaloderma_vittatum">Apaloderma
                                                                            vittatum
                                                                        </option>
                                                                        <option
                                                                            value="Aphelocoma_coerulescens">Aphelocoma
                                                                            coerulescens
                                                                        </option>
                                                                        <option value="Aptenodytes_forsteri">Aptenodytes
                                                                            forsteri
                                                                        </option>
                                                                        <option value="Apteryx_mantelli">Apteryx
                                                                            mantelli
                                                                        </option>
                                                                        <option value="Apteryx_rowi">Apteryx rowi
                                                                        </option>
                                                                        <option value="Apus_apus">Apus apus</option>
                                                                        <option value="Aquila_chrysaetos">Aquila
                                                                            chrysaetos
                                                                        </option>
                                                                        <option
                                                                            value="Archocentrus_centrarchus">Archocentrus
                                                                            centrarchus
                                                                        </option>
                                                                        <option
                                                                            value="Astatotilapia_calliptera">Astatotilapia
                                                                            calliptera
                                                                        </option>
                                                                        <option value="Astyanax_mexicanus">Astyanax
                                                                            mexicanus
                                                                        </option>
                                                                        <option value="Athene_cunicularia">Athene
                                                                            cunicularia
                                                                        </option>
                                                                        <option
                                                                            value="Austrofundulus_limnaeus">Austrofundulus
                                                                            limnaeus
                                                                        </option>
                                                                        <option value="Aythya_fuligula">Aythya
                                                                            fuligula
                                                                        </option>
                                                                        <option value="Balearica_regulorum">Balearica
                                                                            regulorum
                                                                        </option>
                                                                        <option value="Betta_splendens">Betta
                                                                            splendens
                                                                        </option>
                                                                        <option
                                                                            value="Boleophthalmus_pectinirostris">Boleophthalmus
                                                                            pectinirostris
                                                                        </option>
                                                                        <option value="Bombina_bombina">Bombina
                                                                            bombina
                                                                        </option>
                                                                        <option
                                                                            value="Brachionichthys_hirsutus">Brachionichthys
                                                                            hirsutus
                                                                        </option>
                                                                        <option
                                                                            value="Brachyistius_frenatus">Brachyistius
                                                                            frenatus
                                                                        </option>
                                                                        <option
                                                                            value="Brienomyrus_brachyistius">Brienomyrus
                                                                            brachyistius
                                                                        </option>
                                                                        <option value="Buceros_rhinoceros">Buceros
                                                                            rhinoceros
                                                                        </option>
                                                                        <option value="Bufo_bufo">Bufo bufo</option>
                                                                        <option value="Bufo_gargarizans">Bufo
                                                                            gargarizans
                                                                        </option>
                                                                        <option value="Calidris_pugnax">Calidris
                                                                            pugnax
                                                                        </option>
                                                                        <option
                                                                            value="Callorhinchus_milii">Callorhinchus
                                                                            milii
                                                                        </option>
                                                                        <option value="Caloenas_nicobarica">Caloenas
                                                                            nicobarica
                                                                        </option>
                                                                        <option value="Calypte_anna">Calypte anna
                                                                        </option>
                                                                        <option
                                                                            value="Camarhynchus_parvulus">Camarhynchus
                                                                            parvulus
                                                                        </option>
                                                                        <option value="Candoia_aspera">Candoia aspera
                                                                        </option>
                                                                        <option value="Carassius_auratus">Carassius
                                                                            auratus
                                                                        </option>
                                                                        <option value="Carassius_carassius">Carassius
                                                                            carassius
                                                                        </option>
                                                                        <option value="Carassius_gibelio">Carassius
                                                                            gibelio
                                                                        </option>
                                                                        <option
                                                                            value="Carcharodon_carcharias">Carcharodon
                                                                            carcharias
                                                                        </option>
                                                                        <option value="Caretta_caretta">Caretta
                                                                            caretta
                                                                        </option>
                                                                        <option value="Cariama_cristata">Cariama
                                                                            cristata
                                                                        </option>
                                                                        <option value="Catharus_ustulatus">Catharus
                                                                            ustulatus
                                                                        </option>
                                                                        <option
                                                                            value="Cebidichthys_violaceus">Cebidichthys
                                                                            violaceus
                                                                        </option>
                                                                        <option
                                                                            value="Centrocercus_urophasianus">Centrocercus
                                                                            urophasianus
                                                                        </option>
                                                                        <option
                                                                            value="Centropristis_striata">Centropristis
                                                                            striata
                                                                        </option>
                                                                        <option value="Chaetodon_trifascialis">Chaetodon
                                                                            trifascialis
                                                                        </option>
                                                                        <option value="Chaetura_pelagica">Chaetura
                                                                            pelagica
                                                                        </option>
                                                                        <option value="Chamaea_fasciata">Chamaea
                                                                            fasciata
                                                                        </option>
                                                                        <option value="Channa_argus">Channa argus
                                                                        </option>
                                                                        <option
                                                                            value="Chanodichthys_erythropterus">Chanodichthys
                                                                            erythropterus
                                                                        </option>
                                                                        <option value="Chanos_chanos">Chanos chanos
                                                                        </option>
                                                                        <option value="Charadrius_vociferus">Charadrius
                                                                            vociferus
                                                                        </option>
                                                                        <option value="Cheilinus_undulatus">Cheilinus
                                                                            undulatus
                                                                        </option>
                                                                        <option value="Chelmon_rostratus">Chelmon
                                                                            rostratus
                                                                        </option>
                                                                        <option value="Chelonia_mydas">Chelonia mydas
                                                                        </option>
                                                                        <option
                                                                            value="Chelonoidis_abingdonii">Chelonoidis
                                                                            abingdonii
                                                                        </option>
                                                                        <option
                                                                            value="Chiloscyllium_plagiosum">Chiloscyllium
                                                                            plagiosum
                                                                        </option>
                                                                        <option
                                                                            value="Chiroxiphia_lanceolata">Chiroxiphia
                                                                            lanceolata
                                                                        </option>
                                                                        <option
                                                                            value="Chlamydotis_macqueenii">Chlamydotis
                                                                            macqueenii
                                                                        </option>
                                                                        <option
                                                                            value="Chroicocephalus_ridibundus">Chroicocephalus
                                                                            ridibundus
                                                                        </option>
                                                                        <option value="Chrysemys_picta">Chrysemys
                                                                            picta
                                                                        </option>
                                                                        <option value="Cinclus_cinclus">Cinclus
                                                                            cinclus
                                                                        </option>
                                                                        <option value="Clarias_gariepinus">Clarias
                                                                            gariepinus
                                                                        </option>
                                                                        <option value="Clinocottus_analis">Clinocottus
                                                                            analis
                                                                        </option>
                                                                        <option value="Clupea_harengus">Clupea
                                                                            harengus
                                                                        </option>
                                                                        <option value="Colius_striatus">Colius
                                                                            striatus
                                                                        </option>
                                                                        <option value="Cololabis_saira">Cololabis
                                                                            saira
                                                                        </option>
                                                                        <option value="Colossoma_macropomum">Colossoma
                                                                            macropomum
                                                                        </option>
                                                                        <option value="Columba_livia">Columba livia
                                                                        </option>
                                                                        <option value="Conger_conger">Conger conger
                                                                        </option>
                                                                        <option value="Corapipo_altera">Corapipo
                                                                            altera
                                                                        </option>
                                                                        <option value="Coregonus_clupeaformis">Coregonus
                                                                            clupeaformis
                                                                        </option>
                                                                        <option value="Corvus_brachyrhynchos">Corvus
                                                                            brachyrhynchos
                                                                        </option>
                                                                        <option value="Corvus_cornix">Corvus cornix
                                                                        </option>
                                                                        <option value="Corvus_hawaiiensis">Corvus
                                                                            hawaiiensis
                                                                        </option>
                                                                        <option value="Corvus_kubaryi">Corvus kubaryi
                                                                        </option>
                                                                        <option value="Corvus_moneduloides">Corvus
                                                                            moneduloides
                                                                        </option>
                                                                        <option
                                                                            value="Corythoichthys_intestinalis">Corythoichthys
                                                                            intestinalis
                                                                        </option>
                                                                        <option value="Cottoperca_gobio">Cottoperca
                                                                            gobio
                                                                        </option>
                                                                        <option value="Coturnix_japonica">Coturnix
                                                                            japonica
                                                                        </option>
                                                                        <option value="Crocodylus_porosus">Crocodylus
                                                                            porosus
                                                                        </option>
                                                                        <option value="Crotalus_tigris">Crotalus
                                                                            tigris
                                                                        </option>
                                                                        <option
                                                                            value="Ctenopharyngodon_idella">Ctenopharyngodon
                                                                            idella
                                                                        </option>
                                                                        <option value="Cuculus_canorus">Cuculus
                                                                            canorus
                                                                        </option>
                                                                        <option value="Cyanistes_caeruleus">Cyanistes
                                                                            caeruleus
                                                                        </option>
                                                                        <option value="Cyclopterus_lumpus">Cyclopterus
                                                                            lumpus
                                                                        </option>
                                                                        <option value="Cygnus_atratus">Cygnus atratus
                                                                        </option>
                                                                        <option value="Cygnus_olor">Cygnus olor</option>
                                                                        <option
                                                                            value="Cynoglossus_semilaevis">Cynoglossus
                                                                            semilaevis
                                                                        </option>
                                                                        <option value="Cyprinodon_tularosa">Cyprinodon
                                                                            tularosa
                                                                        </option>
                                                                        <option value="Cyprinodon_variegatus">Cyprinodon
                                                                            variegatus
                                                                        </option>
                                                                        <option value="Cyprinus_carpio">Cyprinus
                                                                            carpio
                                                                        </option>
                                                                        <option value="Cyrtonyx_montezumae">Cyrtonyx
                                                                            montezumae
                                                                        </option>
                                                                        <option value="Danio_aesculapii">Danio
                                                                            aesculapii
                                                                        </option>
                                                                        <option value="Danio_rerio">Danio rerio</option>
                                                                        <option
                                                                            value="Dendropsophus_ebraccatus">Dendropsophus
                                                                            ebraccatus
                                                                        </option>
                                                                        <option value="Denticeps_clupeoides">Denticeps
                                                                            clupeoides
                                                                        </option>
                                                                        <option value="Dermochelys_coriacea">Dermochelys
                                                                            coriacea
                                                                        </option>
                                                                        <option
                                                                            value="Dicentrarchus_labrax">Dicentrarchus
                                                                            labrax
                                                                        </option>
                                                                        <option
                                                                            value="Doryrhamphus_excisus">Doryrhamphus
                                                                            excisus
                                                                        </option>
                                                                        <option
                                                                            value="Dromaius_novaehollandiae">Dromaius
                                                                            novaehollandiae
                                                                        </option>
                                                                        <option value="Dryobates_pubescens">Dryobates
                                                                            pubescens
                                                                        </option>
                                                                        <option
                                                                            value="Dunckerocampus_dactyliophorus">Dunckerocampus
                                                                            dactyliophorus
                                                                        </option>
                                                                        <option value="Echeneis_naucrates">Echeneis
                                                                            naucrates
                                                                        </option>
                                                                        <option value="Egretta_garzetta">Egretta
                                                                            garzetta
                                                                        </option>
                                                                        <option
                                                                            value="Electrophorus_electricus">Electrophorus
                                                                            electricus
                                                                        </option>
                                                                        <option value="Eleginops_maclovinus">Eleginops
                                                                            maclovinus
                                                                        </option>
                                                                        <option
                                                                            value="Eleutherodactylus_coqui">Eleutherodactylus
                                                                            coqui
                                                                        </option>
                                                                        <option value="Elgaria_multicarinata">Elgaria
                                                                            multicarinata
                                                                        </option>
                                                                        <option value="Embiotoca_jacksoni">Embiotoca
                                                                            jacksoni
                                                                        </option>
                                                                        <option value="Empidonax_traillii">Empidonax
                                                                            traillii
                                                                        </option>
                                                                        <option value="Emydura_macquarii">Emydura
                                                                            macquarii
                                                                        </option>
                                                                        <option value="Emys_orbicularis">Emys
                                                                            orbicularis
                                                                        </option>
                                                                        <option value="Engraulis_encrasicolus">Engraulis
                                                                            encrasicolus
                                                                        </option>
                                                                        <option value="Enoplosus_armatus">Enoplosus
                                                                            armatus
                                                                        </option>
                                                                        <option value="Entelurus_aequoreus">Entelurus
                                                                            aequoreus
                                                                        </option>
                                                                        <option
                                                                            value="Epinephelus_fuscoguttatus">Epinephelus
                                                                            fuscoguttatus
                                                                        </option>
                                                                        <option
                                                                            value="Epinephelus_lanceolatus">Epinephelus
                                                                            lanceolatus
                                                                        </option>
                                                                        <option value="Epinephelus_moara">Epinephelus
                                                                            moara
                                                                        </option>
                                                                        <option
                                                                            value="Erpetoichthys_calabaricus">Erpetoichthys
                                                                            calabaricus
                                                                        </option>
                                                                        <option
                                                                            value="Erythrolamprus_reginae">Erythrolamprus
                                                                            reginae
                                                                        </option>
                                                                        <option value="Esox_lucius">Esox lucius</option>
                                                                        <option value="Etheostoma_cragini">Etheostoma
                                                                            cragini
                                                                        </option>
                                                                        <option value="Etheostoma_spectabile">Etheostoma
                                                                            spectabile
                                                                        </option>
                                                                        <option
                                                                            value="Eublepharis_macularius">Eublepharis
                                                                            macularius
                                                                        </option>
                                                                        <option value="Euleptes_europaea">Euleptes
                                                                            europaea
                                                                        </option>
                                                                        <option value="Eurypyga_helias">Eurypyga
                                                                            helias
                                                                        </option>
                                                                        <option value="Falco_biarmicus">Falco
                                                                            biarmicus
                                                                        </option>
                                                                        <option value="Falco_cherrug">Falco cherrug
                                                                        </option>
                                                                        <option value="Falco_naumanni">Falco naumanni
                                                                        </option>
                                                                        <option value="Falco_peregrinus">Falco
                                                                            peregrinus
                                                                        </option>
                                                                        <option value="Falco_rusticolus">Falco
                                                                            rusticolus
                                                                        </option>
                                                                        <option value="Ficedula_albicollis">Ficedula
                                                                            albicollis
                                                                        </option>
                                                                        <option value="Fulmarus_glacialis">Fulmarus
                                                                            glacialis
                                                                        </option>
                                                                        <option value="Fundulus_heteroclitus">Fundulus
                                                                            heteroclitus
                                                                        </option>
                                                                        <option value="Gadus_chalcogrammus">Gadus
                                                                            chalcogrammus
                                                                        </option>
                                                                        <option value="Gadus_macrocephalus">Gadus
                                                                            macrocephalus
                                                                        </option>
                                                                        <option value="Gadus_morhua">Gadus morhua
                                                                        </option>
                                                                        <option value="Gallus_gallus">Gallus gallus
                                                                        </option>
                                                                        <option value="Gambusia_affinis">Gambusia
                                                                            affinis
                                                                        </option>
                                                                        <option
                                                                            value="Gasterosteus_aculeatus">Gasterosteus
                                                                            aculeatus
                                                                        </option>
                                                                        <option value="Gavia_stellata">Gavia stellata
                                                                        </option>
                                                                        <option value="Gavialis_gangeticus">Gavialis
                                                                            gangeticus
                                                                        </option>
                                                                        <option value="Gekko_japonicus">Gekko
                                                                            japonicus
                                                                        </option>
                                                                        <option value="Geospiza_fortis">Geospiza
                                                                            fortis
                                                                        </option>
                                                                        <option
                                                                            value="Geotrypetes_seraphini">Geotrypetes
                                                                            seraphini
                                                                        </option>
                                                                        <option
                                                                            value="Girardinichthys_multiradiatus">Girardinichthys
                                                                            multiradiatus
                                                                        </option>
                                                                        <option value="Gopherus_evgoodei">Gopherus
                                                                            evgoodei
                                                                        </option>
                                                                        <option
                                                                            value="Gopherus_flavomarginatus">Gopherus
                                                                            flavomarginatus
                                                                        </option>
                                                                        <option value="Gouania_willdenowi">Gouania
                                                                            willdenowi
                                                                        </option>
                                                                        <option value="Grus_americana">Grus americana
                                                                        </option>
                                                                        <option value="Gymnodraco_acuticeps">Gymnodraco
                                                                            acuticeps
                                                                        </option>
                                                                        <option
                                                                            value="Gymnogyps_californianus">Gymnogyps
                                                                            californianus
                                                                        </option>
                                                                        <option value="Haemorhous_mexicanus">Haemorhous
                                                                            mexicanus
                                                                        </option>
                                                                        <option value="Haliaeetus_albicilla">Haliaeetus
                                                                            albicilla
                                                                        </option>
                                                                        <option
                                                                            value="Haliaeetus_leucocephalus">Haliaeetus
                                                                            leucocephalus
                                                                        </option>
                                                                        <option
                                                                            value="Haplochromis_burtoni">Haplochromis
                                                                            burtoni
                                                                        </option>
                                                                        <option value="Harpia_harpyja">Harpia harpyja
                                                                        </option>
                                                                        <option value="Hemibagrus_wyckioides">Hemibagrus
                                                                            wyckioides
                                                                        </option>
                                                                        <option
                                                                            value="Hemicordylus_capensis">Hemicordylus
                                                                            capensis
                                                                        </option>
                                                                        <option
                                                                            value="Hemiscyllium_ocellatum">Hemiscyllium
                                                                            ocellatum
                                                                        </option>
                                                                        <option value="Heptranchias_perlo">Heptranchias
                                                                            perlo
                                                                        </option>
                                                                        <option
                                                                            value="Heterodontus_francisci">Heterodontus
                                                                            francisci
                                                                        </option>
                                                                        <option value="Heteronotia_binoei">Heteronotia
                                                                            binoei
                                                                        </option>
                                                                        <option value="Hippocampus_comes">Hippocampus
                                                                            comes
                                                                        </option>
                                                                        <option value="Hippocampus_zosterae">Hippocampus
                                                                            zosterae
                                                                        </option>
                                                                        <option
                                                                            value="Hippoglossus_hippoglossus">Hippoglossus
                                                                            hippoglossus
                                                                        </option>
                                                                        <option
                                                                            value="Hippoglossus_stenolepis">Hippoglossus
                                                                            stenolepis
                                                                        </option>
                                                                        <option value="Hirundo_rustica">Hirundo
                                                                            rustica
                                                                        </option>
                                                                        <option value="Hoplias_malabaricus">Hoplias
                                                                            malabaricus
                                                                        </option>
                                                                        <option value="Hyla_sarda">Hyla sarda</option>
                                                                        <option value="Hypanus_sabinus">Hypanus
                                                                            sabinus
                                                                        </option>
                                                                        <option
                                                                            value="Hyperolius_riggenbachi">Hyperolius
                                                                            riggenbachi
                                                                        </option>
                                                                        <option
                                                                            value="Hypomesus_transpacificus">Hypomesus
                                                                            transpacificus
                                                                        </option>
                                                                        <option value="Ictalurus_furcatus">Ictalurus
                                                                            furcatus
                                                                        </option>
                                                                        <option value="Ictalurus_punctatus">Ictalurus
                                                                            punctatus
                                                                        </option>
                                                                        <option value="Indicator_indicator">Indicator
                                                                            indicator
                                                                        </option>
                                                                        <option
                                                                            value="Kryptolebias_marmoratus">Kryptolebias
                                                                            marmoratus
                                                                        </option>
                                                                        <option value="Labeo_rohita">Labeo rohita
                                                                        </option>
                                                                        <option value="Labrus_bergylta">Labrus
                                                                            bergylta
                                                                        </option>
                                                                        <option value="Labrus_mixtus">Labrus mixtus
                                                                        </option>
                                                                        <option value="Lacerta_agilis">Lacerta agilis
                                                                        </option>
                                                                        <option value="Lagopus_leucura">Lagopus
                                                                            leucura
                                                                        </option>
                                                                        <option value="Lagopus_muta">Lagopus muta
                                                                        </option>
                                                                        <option value="Lampris_incognitus">Lampris
                                                                            incognitus
                                                                        </option>
                                                                        <option value="Larimichthys_crocea">Larimichthys
                                                                            crocea
                                                                        </option>
                                                                        <option value="Lates_calcarifer">Lates
                                                                            calcarifer
                                                                        </option>
                                                                        <option value="Lathamus_discolor">Lathamus
                                                                            discolor
                                                                        </option>
                                                                        <option value="Latimeria_chalumnae">Latimeria
                                                                            chalumnae
                                                                        </option>
                                                                        <option value="Lepidothrix_coronata">Lepidothrix
                                                                            coronata
                                                                        </option>
                                                                        <option value="Lepisosteus_oculatus">Lepisosteus
                                                                            oculatus
                                                                        </option>
                                                                        <option value="Leptosomus_discolor">Leptosomus
                                                                            discolor
                                                                        </option>
                                                                        <option
                                                                            value="Lethenteron_reissneri">Lethenteron
                                                                            reissneri
                                                                        </option>
                                                                        <option value="Leucoraja_erinaceus">Leucoraja
                                                                            erinaceus
                                                                        </option>
                                                                        <option value="Limanda_limanda">Limanda
                                                                            limanda
                                                                        </option>
                                                                        <option value="Lonchura_striata">Lonchura
                                                                            striata
                                                                        </option>
                                                                        <option value="Malaclemys_terrapin">Malaclemys
                                                                            terrapin
                                                                        </option>
                                                                        <option value="Malurus_melanocephalus">Malurus
                                                                            melanocephalus
                                                                        </option>
                                                                        <option value="Manacus_candei">Manacus candei
                                                                        </option>
                                                                        <option value="Manacus_vitellinus">Manacus
                                                                            vitellinus
                                                                        </option>
                                                                        <option
                                                                            value="Mastacembelus_armatus">Mastacembelus
                                                                            armatus
                                                                        </option>
                                                                        <option value="Mauremys_mutica">Mauremys
                                                                            mutica
                                                                        </option>
                                                                        <option value="Mauremys_reevesii">Mauremys
                                                                            reevesii
                                                                        </option>
                                                                        <option value="Maylandia_zebra">Maylandia
                                                                            zebra
                                                                        </option>
                                                                        <option
                                                                            value="Megalobrama_amblycephala">Megalobrama
                                                                            amblycephala
                                                                        </option>
                                                                        <option value="Megalops_cyprinoides">Megalops
                                                                            cyprinoides
                                                                        </option>
                                                                        <option
                                                                            value="Melanerpes_formicivorus">Melanerpes
                                                                            formicivorus
                                                                        </option>
                                                                        <option
                                                                            value="Melanotaenia_boesemani">Melanotaenia
                                                                            boesemani
                                                                        </option>
                                                                        <option value="Meleagris_gallopavo">Meleagris
                                                                            gallopavo
                                                                        </option>
                                                                        <option
                                                                            value="Melopsittacus_undulatus">Melopsittacus
                                                                            undulatus
                                                                        </option>
                                                                        <option value="Melospiza_georgiana">Melospiza
                                                                            georgiana
                                                                        </option>
                                                                        <option value="Melospiza_melodia">Melospiza
                                                                            melodia
                                                                        </option>
                                                                        <option value="Melozone_crissalis">Melozone
                                                                            crissalis
                                                                        </option>
                                                                        <option value="Merops_nubicus">Merops nubicus
                                                                        </option>
                                                                        <option value="Mesitornis_unicolor">Mesitornis
                                                                            unicolor
                                                                        </option>
                                                                        <option
                                                                            value="Microcaecilia_unicolor">Microcaecilia
                                                                            unicolor
                                                                        </option>
                                                                        <option value="Micropterus_dolomieu">Micropterus
                                                                            dolomieu
                                                                        </option>
                                                                        <option
                                                                            value="Micropterus_salmoides">Micropterus
                                                                            salmoides
                                                                        </option>
                                                                        <option
                                                                            value="Misgurnus_anguillicaudatus">Misgurnus
                                                                            anguillicaudatus
                                                                        </option>
                                                                        <option value="Mobula_hypostoma">Mobula
                                                                            hypostoma
                                                                        </option>
                                                                        <option value="Molothrus_aeneus">Molothrus
                                                                            aeneus
                                                                        </option>
                                                                        <option value="Molothrus_ater">Molothrus ater
                                                                        </option>
                                                                        <option value="Monopterus_albus">Monopterus
                                                                            albus
                                                                        </option>
                                                                        <option value="Morone_saxatilis">Morone
                                                                            saxatilis
                                                                        </option>
                                                                        <option value="Motacilla_alba">Motacilla alba
                                                                        </option>
                                                                        <option value="Mugil_cephalus">Mugil cephalus
                                                                        </option>
                                                                        <option
                                                                            value="Myiozetetes_cayanensis">Myiozetetes
                                                                            cayanensis
                                                                        </option>
                                                                        <option value="Myripristis_murdjan">Myripristis
                                                                            murdjan
                                                                        </option>
                                                                        <option value="Myxine_glutinosa">Myxine
                                                                            glutinosa
                                                                        </option>
                                                                        <option
                                                                            value="Myxocyprinus_asiaticus">Myxocyprinus
                                                                            asiaticus
                                                                        </option>
                                                                        <option value="Nanorana_parkeri">Nanorana
                                                                            parkeri
                                                                        </option>
                                                                        <option value="Narcine_bancroftii">Narcine
                                                                            bancroftii
                                                                        </option>
                                                                        <option value="Nematolebias_whitei">Nematolebias
                                                                            whitei
                                                                        </option>
                                                                        <option value="Neoarius_graeffei">Neoarius
                                                                            graeffei
                                                                        </option>
                                                                        <option
                                                                            value="Neolamprologus_brichardi">Neolamprologus
                                                                            brichardi
                                                                        </option>
                                                                        <option value="Neopelma_chrysocephalum">Neopelma
                                                                            chrysocephalum
                                                                        </option>
                                                                        <option
                                                                            value="Neopsephotus_bourkii">Neopsephotus
                                                                            bourkii
                                                                        </option>
                                                                        <option value="Nerophis_lumbriciformis">Nerophis
                                                                            lumbriciformis
                                                                        </option>
                                                                        <option value="Nerophis_ophidion">Nerophis
                                                                            ophidion
                                                                        </option>
                                                                        <option value="Nestor_notabilis">Nestor
                                                                            notabilis
                                                                        </option>
                                                                        <option value="Nipponia_nippon">Nipponia
                                                                            nippon
                                                                        </option>
                                                                        <option value="Notechis_scutatus">Notechis
                                                                            scutatus
                                                                        </option>
                                                                        <option
                                                                            value="Nothobranchius_furzeri">Nothobranchius
                                                                            furzeri
                                                                        </option>
                                                                        <option
                                                                            value="Nothoprocta_perdicaria">Nothoprocta
                                                                            perdicaria
                                                                        </option>
                                                                        <option value="Notolabrus_celidotus">Notolabrus
                                                                            celidotus
                                                                        </option>
                                                                        <option value="Notothenia_coriiceps">Notothenia
                                                                            coriiceps
                                                                        </option>
                                                                        <option value="Numida_meleagris">Numida
                                                                            meleagris
                                                                        </option>
                                                                        <option value="Nyctibius_grandis">Nyctibius
                                                                            grandis
                                                                        </option>
                                                                        <option value="Oenanthe_melanoleuca">Oenanthe
                                                                            melanoleuca
                                                                        </option>
                                                                        <option
                                                                            value="Oncorhynchus_clarkii">Oncorhynchus
                                                                            clarkii
                                                                        </option>
                                                                        <option
                                                                            value="Oncorhynchus_gorbuscha">Oncorhynchus
                                                                            gorbuscha
                                                                        </option>
                                                                        <option value="Oncorhynchus_keta">Oncorhynchus
                                                                            keta
                                                                        </option>
                                                                        <option
                                                                            value="Oncorhynchus_kisutch">Oncorhynchus
                                                                            kisutch
                                                                        </option>
                                                                        <option value="Oncorhynchus_masou">Oncorhynchus
                                                                            masou
                                                                        </option>
                                                                        <option value="Oncorhynchus_mykiss">Oncorhynchus
                                                                            mykiss
                                                                        </option>
                                                                        <option value="Oncorhynchus_nerka">Oncorhynchus
                                                                            nerka
                                                                        </option>
                                                                        <option
                                                                            value="Oncorhynchus_tshawytscha">Oncorhynchus
                                                                            tshawytscha
                                                                        </option>
                                                                        <option
                                                                            value="Onychostoma_macrolepis">Onychostoma
                                                                            macrolepis
                                                                        </option>
                                                                        <option
                                                                            value="Onychostruthus_taczanowskii">Onychostruthus
                                                                            taczanowskii
                                                                        </option>
                                                                        <option value="Opisthocomus_hoazin">Opisthocomus
                                                                            hoazin
                                                                        </option>
                                                                        <option value="Oreochromis_aureus">Oreochromis
                                                                            aureus
                                                                        </option>
                                                                        <option
                                                                            value="Oreochromis_niloticus">Oreochromis
                                                                            niloticus
                                                                        </option>
                                                                        <option value="Oryzias_latipes">Oryzias
                                                                            latipes
                                                                        </option>
                                                                        <option value="Oryzias_melastigma">Oryzias
                                                                            melastigma
                                                                        </option>
                                                                        <option value="Osmerus_eperlanus">Osmerus
                                                                            eperlanus
                                                                        </option>
                                                                        <option value="Osmerus_mordax">Osmerus mordax
                                                                        </option>
                                                                        <option value="Oxyura_jamaicensis">Oxyura
                                                                            jamaicensis
                                                                        </option>
                                                                        <option
                                                                            value="Pangasianodon_hypophthalmus">Pangasianodon
                                                                            hypophthalmus
                                                                        </option>
                                                                        <option
                                                                            value="Pantherophis_guttatus">Pantherophis
                                                                            guttatus
                                                                        </option>
                                                                        <option
                                                                            value="Paralichthys_olivaceus">Paralichthys
                                                                            olivaceus
                                                                        </option>
                                                                        <option value="Parambassis_ranga">Parambassis
                                                                            ranga
                                                                        </option>
                                                                        <option
                                                                            value="Paramisgurnus_dabryanus">Paramisgurnus
                                                                            dabryanus
                                                                        </option>
                                                                        <option
                                                                            value="Paramormyrops_kingsleyae">Paramormyrops
                                                                            kingsleyae
                                                                        </option>
                                                                        <option value="Parus_major">Parus major</option>
                                                                        <option value="Passer_domesticus">Passer
                                                                            domesticus
                                                                        </option>
                                                                        <option value="Passer_montanus">Passer
                                                                            montanus
                                                                        </option>
                                                                        <option value="Patagioenas_fasciata">Patagioenas
                                                                            fasciata
                                                                        </option>
                                                                        <option value="Pelecanus_crispus">Pelecanus
                                                                            crispus
                                                                        </option>
                                                                        <option value="Pelmatolapia_mariae">Pelmatolapia
                                                                            mariae
                                                                        </option>
                                                                        <option value="Pelobates_fuscus">Pelobates
                                                                            fuscus
                                                                        </option>
                                                                        <option value="Pelodiscus_sinensis">Pelodiscus
                                                                            sinensis
                                                                        </option>
                                                                        <option value="Pempheris_klunzingeri">Pempheris
                                                                            klunzingeri
                                                                        </option>
                                                                        <option value="Perca_flavescens">Perca
                                                                            flavescens
                                                                        </option>
                                                                        <option value="Perca_fluviatilis">Perca
                                                                            fluviatilis
                                                                        </option>
                                                                        <option
                                                                            value="Periophthalmus_magnuspinnatus">Periophthalmus
                                                                            magnuspinnatus
                                                                        </option>
                                                                        <option value="Petromyzon_marinus">Petromyzon
                                                                            marinus
                                                                        </option>
                                                                        <option value="Pezoporus_flaviventris">Pezoporus
                                                                            flaviventris
                                                                        </option>
                                                                        <option value="Pezoporus_occidentalis">Pezoporus
                                                                            occidentalis
                                                                        </option>
                                                                        <option value="Pezoporus_wallicus">Pezoporus
                                                                            wallicus
                                                                        </option>
                                                                        <option
                                                                            value="Phaenicophaeus_curvirostris">Phaenicophaeus
                                                                            curvirostris
                                                                        </option>
                                                                        <option value="Phaethon_lepturus">Phaethon
                                                                            lepturus
                                                                        </option>
                                                                        <option
                                                                            value="Phalacrocorax_carbo">Phalacrocorax
                                                                            carbo
                                                                        </option>
                                                                        <option value="Phasianus_colchicus">Phasianus
                                                                            colchicus
                                                                        </option>
                                                                        <option value="Phycodurus_eques">Phycodurus
                                                                            eques
                                                                        </option>
                                                                        <option
                                                                            value="Phyllopteryx_taeniolatus">Phyllopteryx
                                                                            taeniolatus
                                                                        </option>
                                                                        <option value="Pimephales_promelas">Pimephales
                                                                            promelas
                                                                        </option>
                                                                        <option value="Pipra_filicauda">Pipra
                                                                            filicauda
                                                                        </option>
                                                                        <option value="Pituophis_catenifer">Pituophis
                                                                            catenifer
                                                                        </option>
                                                                        <option value="Platichthys_flesus">Platichthys
                                                                            flesus
                                                                        </option>
                                                                        <option
                                                                            value="Plectropomus_leopardus">Plectropomus
                                                                            leopardus
                                                                        </option>
                                                                        <option value="Pleurodeles_waltl">Pleurodeles
                                                                            waltl
                                                                        </option>
                                                                        <option
                                                                            value="Pleuronectes_platessa">Pleuronectes
                                                                            platessa
                                                                        </option>
                                                                        <option value="Podarcis_muralis">Podarcis
                                                                            muralis
                                                                        </option>
                                                                        <option value="Podarcis_raffonei">Podarcis
                                                                            raffonei
                                                                        </option>
                                                                        <option value="Poecile_atricapillus">Poecile
                                                                            atricapillus
                                                                        </option>
                                                                        <option value="Poecilia_formosa">Poecilia
                                                                            formosa
                                                                        </option>
                                                                        <option value="Poecilia_latipinna">Poecilia
                                                                            latipinna
                                                                        </option>
                                                                        <option value="Poecilia_mexicana">Poecilia
                                                                            mexicana
                                                                        </option>
                                                                        <option value="Poecilia_reticulata">Poecilia
                                                                            reticulata
                                                                        </option>
                                                                        <option
                                                                            value="Poeciliopsis_prolifica">Poeciliopsis
                                                                            prolifica
                                                                        </option>
                                                                        <option value="Pogona_vitticeps">Pogona
                                                                            vitticeps
                                                                        </option>
                                                                        <option value="Pogoniulus_pusillus">Pogoniulus
                                                                            pusillus
                                                                        </option>
                                                                        <option value="Polyodon_spathula">Polyodon
                                                                            spathula
                                                                        </option>
                                                                        <option value="Polypterus_senegalus">Polypterus
                                                                            senegalus
                                                                        </option>
                                                                        <option value="Prinia_subflava">Prinia
                                                                            subflava
                                                                        </option>
                                                                        <option
                                                                            value="Pristiophorus_japonicus">Pristiophorus
                                                                            japonicus
                                                                        </option>
                                                                        <option value="Pristis_pectinata">Pristis
                                                                            pectinata
                                                                        </option>
                                                                        <option
                                                                            value="Protobothrops_mucrosquamatus">Protobothrops
                                                                            mucrosquamatus
                                                                        </option>
                                                                        <option
                                                                            value="Protopterus_annectens">Protopterus
                                                                            annectens
                                                                        </option>
                                                                        <option
                                                                            value="Pseudochaenichthys_georgianus">Pseudochaenichthys
                                                                            georgianus
                                                                        </option>
                                                                        <option
                                                                            value="Pseudoliparis_swirei">Pseudoliparis
                                                                            swirei
                                                                        </option>
                                                                        <option value="Pseudonaja_textilis">Pseudonaja
                                                                            textilis
                                                                        </option>
                                                                        <option
                                                                            value="Pseudophryne_corroboree">Pseudophryne
                                                                            corroboree
                                                                        </option>
                                                                        <option value="Pseudopipra_pipra">Pseudopipra
                                                                            pipra
                                                                        </option>
                                                                        <option
                                                                            value="Pseudopodoces_humilis">Pseudopodoces
                                                                            humilis
                                                                        </option>
                                                                        <option
                                                                            value="Pseudorasbora_parva">Pseudorasbora
                                                                            parva
                                                                        </option>
                                                                        <option value="Pterocles_gutturalis">Pterocles
                                                                            gutturalis
                                                                        </option>
                                                                        <option value="Pundamilia_nyererei">Pundamilia
                                                                            nyererei
                                                                        </option>
                                                                        <option value="Pungitius_pungitius">Pungitius
                                                                            pungitius
                                                                        </option>
                                                                        <option value="Puntigrus_tetrazona">Puntigrus
                                                                            tetrazona
                                                                        </option>
                                                                        <option
                                                                            value="Pygocentrus_nattereri">Pygocentrus
                                                                            nattereri
                                                                        </option>
                                                                        <option value="Pygoscelis_adeliae">Pygoscelis
                                                                            adeliae
                                                                        </option>
                                                                        <option value="Pyrgilauda_ruficollis">Pyrgilauda
                                                                            ruficollis
                                                                        </option>
                                                                        <option value="Python_bivittatus">Python
                                                                            bivittatus
                                                                        </option>
                                                                        <option value="Rana_temporaria">Rana
                                                                            temporaria
                                                                        </option>
                                                                        <option value="Ranitomeya_imitator">Ranitomeya
                                                                            imitator
                                                                        </option>
                                                                        <option value="Rhea_pennata">Rhea pennata
                                                                        </option>
                                                                        <option value="Rhinatrema_bivittatum">Rhinatrema
                                                                            bivittatum
                                                                        </option>
                                                                        <option value="Rhincodon_typus">Rhincodon
                                                                            typus
                                                                        </option>
                                                                        <option value="Rhineura_floridana">Rhineura
                                                                            floridana
                                                                        </option>
                                                                        <option
                                                                            value="Rhinichthys_klamathensis">Rhinichthys
                                                                            klamathensis
                                                                        </option>
                                                                        <option value="Rissa_tridactyla">Rissa
                                                                            tridactyla
                                                                        </option>
                                                                        <option value="Salarias_fasciatus">Salarias
                                                                            fasciatus
                                                                        </option>
                                                                        <option value="Salmo_salar">Salmo salar</option>
                                                                        <option value="Salmo_trutta">Salmo trutta
                                                                        </option>
                                                                        <option value="Salvelinus_alpinus">Salvelinus
                                                                            alpinus
                                                                        </option>
                                                                        <option value="Salvelinus_fontinalis">Salvelinus
                                                                            fontinalis
                                                                        </option>
                                                                        <option value="Salvelinus_namaycush">Salvelinus
                                                                            namaycush
                                                                        </option>
                                                                        <option value="Salvelinus_sp">Salvelinus sp
                                                                        </option>
                                                                        <option value="Sander_lucioperca">Sander
                                                                            lucioperca
                                                                        </option>
                                                                        <option value="Sardina_pilchardus">Sardina
                                                                            pilchardus
                                                                        </option>
                                                                        <option value="Scatophagus_argus">Scatophagus
                                                                            argus
                                                                        </option>
                                                                        <option value="Sceloporus_undulatus">Sceloporus
                                                                            undulatus
                                                                        </option>
                                                                        <option value="Scleropages_formosus">Scleropages
                                                                            formosus
                                                                        </option>
                                                                        <option value="Scomber_japonicus">Scomber
                                                                            japonicus
                                                                        </option>
                                                                        <option value="Scomber_scombrus">Scomber
                                                                            scombrus
                                                                        </option>
                                                                        <option
                                                                            value="Scophthalmus_maximus">Scophthalmus
                                                                            maximus
                                                                        </option>
                                                                        <option
                                                                            value="Scyliorhinus_canicula">Scyliorhinus
                                                                            canicula
                                                                        </option>
                                                                        <option value="Sebastes_umbrosus">Sebastes
                                                                            umbrosus
                                                                        </option>
                                                                        <option
                                                                            value="Semicossyphus_pulcher">Semicossyphus
                                                                            pulcher
                                                                        </option>
                                                                        <option value="Serinus_canaria">Serinus
                                                                            canaria
                                                                        </option>
                                                                        <option value="Seriola_aureovittata">Seriola
                                                                            aureovittata
                                                                        </option>
                                                                        <option value="Seriola_dumerili">Seriola
                                                                            dumerili
                                                                        </option>
                                                                        <option value="Seriola_lalandi">Seriola
                                                                            lalandi
                                                                        </option>
                                                                        <option value="Silurus_meridionalis">Silurus
                                                                            meridionalis
                                                                        </option>
                                                                        <option
                                                                            value="Simochromis_diagramma">Simochromis
                                                                            diagramma
                                                                        </option>
                                                                        <option value="Siniperca_chuatsi">Siniperca
                                                                            chuatsi
                                                                        </option>
                                                                        <option
                                                                            value="Sinocyclocheilus_anshuiensis">Sinocyclocheilus
                                                                            anshuiensis
                                                                        </option>
                                                                        <option
                                                                            value="Sinocyclocheilus_grahami">Sinocyclocheilus
                                                                            grahami
                                                                        </option>
                                                                        <option
                                                                            value="Sinocyclocheilus_rhinocerous">Sinocyclocheilus
                                                                            rhinocerous
                                                                        </option>
                                                                        <option value="Solea_senegalensis">Solea
                                                                            senegalensis
                                                                        </option>
                                                                        <option value="Solea_solea">Solea solea</option>
                                                                        <option value="Sparus_aurata">Sparus aurata
                                                                        </option>
                                                                        <option value="Spea_bombifrons">Spea
                                                                            bombifrons
                                                                        </option>
                                                                        <option
                                                                            value="Sphaeramia_orbicularis">Sphaeramia
                                                                            orbicularis
                                                                        </option>
                                                                        <option
                                                                            value="Sphaerodactylus_townsendi">Sphaerodactylus
                                                                            townsendi
                                                                        </option>
                                                                        <option value="Stegastes_partitus">Stegastes
                                                                            partitus
                                                                        </option>
                                                                        <option value="Stegostoma_tigrinum">Stegostoma
                                                                            tigrinum
                                                                        </option>
                                                                        <option value="Strigops_habroptila">Strigops
                                                                            habroptila
                                                                        </option>
                                                                        <option value="Struthio_camelus">Struthio
                                                                            camelus
                                                                        </option>
                                                                        <option value="Sturnus_vulgaris">Sturnus
                                                                            vulgaris
                                                                        </option>
                                                                        <option value="Sylvia_atricapilla">Sylvia
                                                                            atricapilla
                                                                        </option>
                                                                        <option
                                                                            value="Synchiropus_splendidus">Synchiropus
                                                                            splendidus
                                                                        </option>
                                                                        <option
                                                                            value="Syngnathoides_biaculeatus">Syngnathoides
                                                                            biaculeatus
                                                                        </option>
                                                                        <option value="Syngnathus_acus">Syngnathus
                                                                            acus
                                                                        </option>
                                                                        <option value="Syngnathus_scovelli">Syngnathus
                                                                            scovelli
                                                                        </option>
                                                                        <option value="Syngnathus_typhle">Syngnathus
                                                                            typhle
                                                                        </option>
                                                                        <option value="Tachysurus_fulvidraco">Tachysurus
                                                                            fulvidraco
                                                                        </option>
                                                                        <option value="Tachysurus_vachellii">Tachysurus
                                                                            vachellii
                                                                        </option>
                                                                        <option value="Taeniopygia_guttata">Taeniopygia
                                                                            guttata
                                                                        </option>
                                                                        <option value="Takifugu_flavidus">Takifugu
                                                                            flavidus
                                                                        </option>
                                                                        <option value="Takifugu_rubripes">Takifugu
                                                                            rubripes
                                                                        </option>
                                                                        <option value="Tauraco_erythrolophus">Tauraco
                                                                            erythrolophus
                                                                        </option>
                                                                        <option value="Terrapene_triunguis">Terrapene
                                                                            triunguis
                                                                        </option>
                                                                        <option
                                                                            value="Thalassophryne_amazonica">Thalassophryne
                                                                            amazonica
                                                                        </option>
                                                                        <option value="Thamnophis_elegans">Thamnophis
                                                                            elegans
                                                                        </option>
                                                                        <option value="Thamnophis_sirtalis">Thamnophis
                                                                            sirtalis
                                                                        </option>
                                                                        <option value="Thunnus_albacares">Thunnus
                                                                            albacares
                                                                        </option>
                                                                        <option value="Thunnus_maccoyii">Thunnus
                                                                            maccoyii
                                                                        </option>
                                                                        <option value="Thunnus_thynnus">Thunnus
                                                                            thynnus
                                                                        </option>
                                                                        <option value="Tiliqua_scincoides">Tiliqua
                                                                            scincoides
                                                                        </option>
                                                                        <option value="Tinamus_guttatus">Tinamus
                                                                            guttatus
                                                                        </option>
                                                                        <option value="Toxotes_jaculatrix">Toxotes
                                                                            jaculatrix
                                                                        </option>
                                                                        <option value="Trachemys_scripta">Trachemys
                                                                            scripta
                                                                        </option>
                                                                        <option value="Trachinotus_anak">Trachinotus
                                                                            anak
                                                                        </option>
                                                                        <option value="Trematomus_bernacchii">Trematomus
                                                                            bernacchii
                                                                        </option>
                                                                        <option
                                                                            value="Trichomycterus_rosablanca">Trichomycterus
                                                                            rosablanca
                                                                        </option>
                                                                        <option value="Triplophysa_dalaica">Triplophysa
                                                                            dalaica
                                                                        </option>
                                                                        <option value="Triplophysa_rosa">Triplophysa
                                                                            rosa
                                                                        </option>
                                                                        <option
                                                                            value="Tympanuchus_pallidicinctus">Tympanuchus
                                                                            pallidicinctus
                                                                        </option>
                                                                        <option value="Tyto_alba">Tyto alba</option>
                                                                        <option value="Varanus_komodoensis">Varanus
                                                                            komodoensis
                                                                        </option>
                                                                        <option value="Vidua_chalybeata">Vidua
                                                                            chalybeata
                                                                        </option>
                                                                        <option value="Vidua_macroura">Vidua macroura
                                                                        </option>
                                                                        <option value="Xenopus_laevis">Xenopus laevis
                                                                        </option>
                                                                        <option value="Xenopus_tropicalis">Xenopus
                                                                            tropicalis
                                                                        </option>
                                                                        <option value="Xiphias_gladius">Xiphias
                                                                            gladius
                                                                        </option>
                                                                        <option
                                                                            value="Xiphophorus_couchianus">Xiphophorus
                                                                            couchianus
                                                                        </option>
                                                                        <option value="Xiphophorus_hellerii">Xiphophorus
                                                                            hellerii
                                                                        </option>
                                                                        <option
                                                                            value="Xiphophorus_maculatus">Xiphophorus
                                                                            maculatus
                                                                        </option>
                                                                        <option value="Xyrauchen_texanus">Xyrauchen
                                                                            texanus
                                                                        </option>
                                                                        <option
                                                                            value="Zonotrichia_albicollis">Zonotrichia
                                                                            albicollis
                                                                        </option>
                                                                        <option
                                                                            value="Zonotrichia_leucophrys">Zonotrichia
                                                                            leucophrys
                                                                        </option>
                                                                        <option value="Zootoca_vivipara">Zootoca
                                                                            vivipara
                                                                        </option>
                                                                    </select>


                                                                </>
                                                            ) :
                                                            formDataNcbi.source_params.taxon.value === "viral" ? (
                                                                <>
                                                                    <select
                                                                        className="form-control"
                                                                        id="species"
                                                                        value={formDataNcbi.source_params.species.value}
                                                                        onChange={handleChange}
                                                                    >
                                                                        <option value="">Select a species</option>
                                                                        {/* Fill with protist species */}
                                                                    </select>


                                                                </>
                                                            ) : null}
                                                    </div>


                                                    <div className="mb-3">
                                                        <label htmlFor="annotation_release" className="form-label">Annotation
                                                            Release</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="annotation_release"
                                                            value={formDataNcbi.source_params.annotation_release.value}
                                                            onChange={handleChange}
                                                            placeholder="current"
                                                        />
                                                    </div>


                                                    <h5>Genomic Regions</h5>

                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                        <div className="col-md-4 mb-3" key={region}>
                                                            <div className="form-check">
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    id={region}
                                                                    name={region}
                                                                    checked={formDataNcbi.genomic_regions[region as keyof typeof formDataNcbi.genomic_regions]?.value === "true"}
                                                                    onChange={(e) =>
                                                                        setFormDataNcbi((prev) => ({
                                                                            ...prev,
                                                                            genomic_regions: {
                                                                                ...prev.genomic_regions,
                                                                                [region]: {
                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                    value: e.target.checked ? "true" : "false",
                                                                                },
                                                                            },
                                                                        }))
                                                                    }
                                                                />
                                                                <label htmlFor={region} className="form-check-label">
                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {formDataNcbi.genomic_regions.exon_exon_junction.value === "true" && (
                                                        <div className="mb-3">
                                                            <label htmlFor="exon_exon_junction_block_size"
                                                                   className="form-label">
                                                                Exon-Exon-Junction Block Size
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                id="exon_exon_junction_block_size"
                                                                value={formDataNcbi.exon_exon_junction_block_size.value}
                                                                onChange={handleChange}
                                                                placeholder="50"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="d-flex flex-column align-items-center mt-4">
                                                        {/* Submit Button */}
                                                        <button onClick={handleSubmit}
                                                                className="btn btn-success btn-lg" disabled={loading}>
                                                            {loading ? (
                                                                <>
                                                                    <span
                                                                        className="spinner-border spinner-border-sm me-2"></span>
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                "Submit"
                                                            )}
                                                        </button>

                                                        {/* Loading Animation */}
                                                        {loading && (
                                                            <div className="d-flex flex-column align-items-center mt-3">
                                                                <div className="spinner-border text-primary"
                                                                     style={{width: "3rem", height: "3rem"}}></div>
                                                                <p className="mt-2 text-muted">Processing file, please
                                                                    wait...</p>
                                                            </div>
                                                        )}

                                                        {/* Download Button - Appears only when the file is ready */}
                                                        {fileReady && (
                                                            <button onClick={handleDownload}
                                                                    className="btn btn-primary btn-lg mt-4">
                                                                <i className="bi bi-download me-2"></i> Download File
                                                            </button>
                                                        )}
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    {selectedSource === "ensembl" && (
                                        <div className="card shadow-sm mb-4 border-success">
                                            <div className="card-header">
                                                <h5>🔬 Ensembl Configuration</h5>
                                            </div>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="mb-3">
                                                        <label htmlFor="species" className="form-label">Species</label>
                                                        <select
                                                            className="form-control"
                                                            id="species"
                                                            value={formDataEns.source_params.species.value}
                                                            onChange={handleChange}
                                                        >
                                                            <option value="acanthochromis_polyacanthus">acanthochromis
                                                                polyacanthus
                                                            </option>
                                                            <option value="accipiter_nisus">accipiter nisus</option>
                                                            <option value="ailuropoda_melanoleuca">ailuropoda
                                                                melanoleuca
                                                            </option>
                                                            <option value="amazona_collaria">amazona collaria</option>
                                                            <option value="amphilophus_citrinellus">amphilophus
                                                                citrinellus
                                                            </option>
                                                            <option value="amphiprion_ocellaris">amphiprion ocellaris
                                                            </option>
                                                            <option value="amphiprion_percula">amphiprion percula
                                                            </option>
                                                            <option value="anabas_testudineus">anabas testudineus
                                                            </option>
                                                            <option value="anas_platyrhynchos">anas platyrhynchos
                                                            </option>
                                                            <option value="anas_platyrhynchos_platyrhynchos">anas
                                                                platyrhynchos platyrhynchos
                                                            </option>
                                                            <option value="anas_zonorhyncha">anas zonorhyncha</option>
                                                            <option value="anolis_carolinensis">anolis carolinensis
                                                            </option>
                                                            <option value="anser_brachyrhynchus">anser brachyrhynchus
                                                            </option>
                                                            <option value="anser_cygnoides">anser cygnoides</option>
                                                            <option value="aotus_nancymaae">aotus nancymaae</option>
                                                            <option value="apteryx_haastii">apteryx haastii</option>
                                                            <option value="apteryx_owenii">apteryx owenii</option>
                                                            <option value="apteryx_rowi">apteryx rowi</option>
                                                            <option value="aquila_chrysaetos_chrysaetos">aquila
                                                                chrysaetos chrysaetos
                                                            </option>
                                                            <option value="astatotilapia_calliptera">astatotilapia
                                                                calliptera
                                                            </option>
                                                            <option value="astyanax_mexicanus">astyanax mexicanus
                                                            </option>
                                                            <option value="astyanax_mexicanus_pachon">astyanax mexicanus
                                                                pachon
                                                            </option>
                                                            <option value="athene_cunicularia">athene cunicularia
                                                            </option>
                                                            <option value="balaenoptera_musculus">balaenoptera
                                                                musculus
                                                            </option>
                                                            <option value="betta_splendens">betta splendens</option>
                                                            <option value="bison_bison_bison">bison bison bison</option>
                                                            <option value="bos_grunniens">bos grunniens</option>
                                                            <option value="bos_indicus_hybrid">bos indicus hybrid
                                                            </option>
                                                            <option value="bos_mutus">bos mutus</option>
                                                            <option value="bos_taurus">bos taurus</option>
                                                            <option value="bos_taurus_hybrid">bos taurus hybrid</option>
                                                            <option value="bubo_bubo">bubo bubo</option>
                                                            <option value="buteo_japonicus">buteo japonicus</option>
                                                            <option value="caenorhabditis_elegans">caenorhabditis
                                                                elegans
                                                            </option>
                                                            <option value="cairina_moschata_domestica">cairina moschata
                                                                domestica
                                                            </option>
                                                            <option value="calidris_pugnax">calidris pugnax</option>
                                                            <option value="calidris_pygmaea">calidris pygmaea</option>
                                                            <option value="callithrix_jacchus">callithrix jacchus
                                                            </option>
                                                            <option value="callorhinchus_milii">callorhinchus milii
                                                            </option>
                                                            <option value="camarhynchus_parvulus">camarhynchus
                                                                parvulus
                                                            </option>
                                                            <option value="camelus_dromedarius">camelus dromedarius
                                                            </option>
                                                            <option value="canis_lupus_dingo">canis lupus dingo</option>
                                                            <option value="canis_lupus_familiaris">canis lupus
                                                                familiaris
                                                            </option>
                                                            <option value="canis_lupus_familiarisbasenji">canis lupus
                                                                familiarisbasenji
                                                            </option>
                                                            <option value="canis_lupus_familiarisboxer">canis lupus
                                                                familiarisboxer
                                                            </option>
                                                            <option value="canis_lupus_familiarisgreatdane">canis lupus
                                                                familiarisgreatdane
                                                            </option>
                                                            <option value="canis_lupus_familiarisgsd">canis lupus
                                                                familiarisgsd
                                                            </option>
                                                            <option value="capra_hircus">capra hircus</option>
                                                            <option value="capra_hircus_blackbengal">capra hircus
                                                                blackbengal
                                                            </option>
                                                            <option value="carassius_auratus">carassius auratus</option>
                                                            <option value="carlito_syrichta">carlito syrichta</option>
                                                            <option value="castor_canadensis">castor canadensis</option>
                                                            <option value="catagonus_wagneri">catagonus wagneri</option>
                                                            <option value="catharus_ustulatus">catharus ustulatus
                                                            </option>
                                                            <option value="cavia_aperea">cavia aperea</option>
                                                            <option value="cavia_porcellus">cavia porcellus</option>
                                                            <option value="cebus_capucinus">cebus capucinus</option>
                                                            <option value="cebus_imitator">cebus imitator</option>
                                                            <option value="cercocebus_atys">cercocebus atys</option>
                                                            <option value="cervus_hanglu_yarkandensis">cervus hanglu
                                                                yarkandensis
                                                            </option>
                                                            <option value="chelonoidis_abingdonii">chelonoidis
                                                                abingdonii
                                                            </option>
                                                            <option value="chelydra_serpentina">chelydra serpentina
                                                            </option>
                                                            <option value="chinchilla_lanigera">chinchilla lanigera
                                                            </option>
                                                            <option value="chlorocebus_sabaeus">chlorocebus sabaeus
                                                            </option>
                                                            <option value="choloepus_hoffmanni">choloepus hoffmanni
                                                            </option>
                                                            <option value="chrysemys_picta_bellii">chrysemys picta
                                                                bellii
                                                            </option>
                                                            <option value="chrysolophus_pictus">chrysolophus pictus
                                                            </option>
                                                            <option value="ciona_intestinalis">ciona intestinalis
                                                            </option>
                                                            <option value="ciona_savignyi">ciona savignyi</option>
                                                            <option value="clupea_harengus">clupea harengus</option>
                                                            <option value="colobus_angolensis_palliatus">colobus
                                                                angolensis palliatus
                                                            </option>
                                                            <option value="corvus_moneduloides">corvus moneduloides
                                                            </option>
                                                            <option value="cottoperca_gobio">cottoperca gobio</option>
                                                            <option value="coturnix_japonica">coturnix japonica</option>
                                                            <option value="cricetulus_griseus_chok1gshd">cricetulus
                                                                griseus chok1gshd
                                                            </option>
                                                            <option value="cricetulus_griseus_crigri">cricetulus griseus
                                                                crigri
                                                            </option>
                                                            <option value="cricetulus_griseus_picr">cricetulus griseus
                                                                picr
                                                            </option>
                                                            <option value="crocodylus_porosus">crocodylus porosus
                                                            </option>
                                                            <option value="cyanistes_caeruleus">cyanistes caeruleus
                                                            </option>
                                                            <option value="cyclopterus_lumpus">cyclopterus lumpus
                                                            </option>
                                                            <option value="cynoglossus_semilaevis">cynoglossus
                                                                semilaevis
                                                            </option>
                                                            <option value="cyprinodon_variegatus">cyprinodon
                                                                variegatus
                                                            </option>
                                                            <option value="cyprinus_carpio_carpio">cyprinus carpio
                                                                carpio
                                                            </option>
                                                            <option value="cyprinus_carpio_germanmirror">cyprinus carpio
                                                                germanmirror
                                                            </option>
                                                            <option value="cyprinus_carpio_hebaored">cyprinus carpio
                                                                hebaored
                                                            </option>
                                                            <option value="cyprinus_carpio_huanghe">cyprinus carpio
                                                                huanghe
                                                            </option>
                                                            <option value="danio_rerio">danio rerio</option>
                                                            <option value="dasypus_novemcinctus">dasypus novemcinctus
                                                            </option>
                                                            <option value="delphinapterus_leucas">delphinapterus
                                                                leucas
                                                            </option>
                                                            <option value="denticeps_clupeoides">denticeps clupeoides
                                                            </option>
                                                            <option value="dicentrarchus_labrax">dicentrarchus labrax
                                                            </option>
                                                            <option value="dipodomys_ordii">dipodomys ordii</option>
                                                            <option value="dromaius_novaehollandiae">dromaius
                                                                novaehollandiae
                                                            </option>
                                                            <option value="drosophila_melanogaster">drosophila
                                                                melanogaster
                                                            </option>
                                                            <option value="echeneis_naucrates">echeneis naucrates
                                                            </option>
                                                            <option value="echinops_telfairi">echinops telfairi</option>
                                                            <option value="electrophorus_electricus">electrophorus
                                                                electricus
                                                            </option>
                                                            <option value="eptatretus_burgeri">eptatretus burgeri
                                                            </option>
                                                            <option value="equus_asinus_asinus">equus asinus asinus
                                                            </option>
                                                            <option value="equus_caballus">equus caballus</option>
                                                            <option value="erinaceus_europaeus">erinaceus europaeus
                                                            </option>
                                                            <option value="erpetoichthys_calabaricus">erpetoichthys
                                                                calabaricus
                                                            </option>
                                                            <option value="erythrura_gouldiae">erythrura gouldiae
                                                            </option>
                                                            <option value="esox_lucius">esox lucius</option>
                                                            <option value="falco_tinnunculus">falco tinnunculus</option>
                                                            <option value="felis_catus">felis catus</option>
                                                            <option value="ficedula_albicollis">ficedula albicollis
                                                            </option>
                                                            <option value="fukomys_damarensis">fukomys damarensis
                                                            </option>
                                                            <option value="fundulus_heteroclitus">fundulus
                                                                heteroclitus
                                                            </option>
                                                            <option value="gadus_morhua">gadus morhua</option>
                                                            <option value="gallus_gallus">gallus gallus</option>
                                                            <option value="gallus_gallus_gca000002315v5">gallus gallus
                                                                gca000002315v5
                                                            </option>
                                                            <option value="gallus_gallus_gca016700215v2">gallus gallus
                                                                gca016700215v2
                                                            </option>
                                                            <option value="gambusia_affinis">gambusia affinis</option>
                                                            <option value="gasterosteus_aculeatus">gasterosteus
                                                                aculeatus
                                                            </option>
                                                            <option value="geospiza_fortis">geospiza fortis</option>
                                                            <option value="gopherus_agassizii">gopherus agassizii
                                                            </option>
                                                            <option value="gopherus_evgoodei">gopherus evgoodei</option>
                                                            <option value="gorilla_gorilla">gorilla gorilla</option>
                                                            <option value="gouania_willdenowi">gouania willdenowi
                                                            </option>
                                                            <option value="haplochromis_burtoni">haplochromis burtoni
                                                            </option>
                                                            <option value="heterocephalus_glaber_female">heterocephalus
                                                                glaber female
                                                            </option>
                                                            <option value="heterocephalus_glaber_male">heterocephalus
                                                                glaber male
                                                            </option>
                                                            <option value="hippocampus_comes">hippocampus comes</option>
                                                            <option value="homo_sapiens">homo sapiens</option>
                                                            <option value="hucho_hucho">hucho hucho</option>
                                                            <option value="ictalurus_punctatus">ictalurus punctatus
                                                            </option>
                                                            <option value="ictidomys_tridecemlineatus">ictidomys
                                                                tridecemlineatus
                                                            </option>
                                                            <option value="jaculus_jaculus">jaculus jaculus</option>
                                                            <option value="junco_hyemalis">junco hyemalis</option>
                                                            <option value="kryptolebias_marmoratus">kryptolebias
                                                                marmoratus
                                                            </option>
                                                            <option value="labrus_bergylta">labrus bergylta</option>
                                                            <option value="larimichthys_crocea">larimichthys crocea
                                                            </option>
                                                            <option value="lates_calcarifer">lates calcarifer</option>
                                                            <option value="laticauda_laticaudata">laticauda
                                                                laticaudata
                                                            </option>
                                                            <option value="latimeria_chalumnae">latimeria chalumnae
                                                            </option>
                                                            <option value="lepidothrix_coronata">lepidothrix coronata
                                                            </option>
                                                            <option value="lepisosteus_oculatus">lepisosteus oculatus
                                                            </option>
                                                            <option value="leptobrachium_leishanense">leptobrachium
                                                                leishanense
                                                            </option>
                                                            <option value="lonchura_striata_domestica">lonchura striata
                                                                domestica
                                                            </option>
                                                            <option value="loxodonta_africana">loxodonta africana
                                                            </option>
                                                            <option value="lynx_canadensis">lynx canadensis</option>
                                                            <option value="macaca_fascicularis">macaca fascicularis
                                                            </option>
                                                            <option value="macaca_mulatta">macaca mulatta</option>
                                                            <option value="macaca_nemestrina">macaca nemestrina</option>
                                                            <option value="malurus_cyaneus_samueli">malurus cyaneus
                                                                samueli
                                                            </option>
                                                            <option value="manacus_vitellinus">manacus vitellinus
                                                            </option>
                                                            <option value="mandrillus_leucophaeus">mandrillus
                                                                leucophaeus
                                                            </option>
                                                            <option value="marmota_marmota_marmota">marmota marmota
                                                                marmota
                                                            </option>
                                                            <option value="mastacembelus_armatus">mastacembelus
                                                                armatus
                                                            </option>
                                                            <option value="maylandia_zebra">maylandia zebra</option>
                                                            <option value="meleagris_gallopavo">meleagris gallopavo
                                                            </option>
                                                            <option value="melopsittacus_undulatus">melopsittacus
                                                                undulatus
                                                            </option>
                                                            <option value="meriones_unguiculatus">meriones
                                                                unguiculatus
                                                            </option>
                                                            <option value="mesocricetus_auratus">mesocricetus auratus
                                                            </option>
                                                            <option value="microcebus_murinus">microcebus murinus
                                                            </option>
                                                            <option value="microtus_ochrogaster">microtus ochrogaster
                                                            </option>
                                                            <option value="mola_mola">mola mola</option>
                                                            <option value="monodelphis_domestica">monodelphis
                                                                domestica
                                                            </option>
                                                            <option value="monodon_monoceros">monodon monoceros</option>
                                                            <option value="monopterus_albus">monopterus albus</option>
                                                            <option value="moschus_moschiferus">moschus moschiferus
                                                            </option>
                                                            <option value="mus_caroli">mus caroli</option>
                                                            <option value="mus_musculus">mus musculus</option>
                                                            <option value="mus_musculus_129s1svimj">mus musculus
                                                                129s1svimj
                                                            </option>
                                                            <option value="mus_musculus_aj">mus musculus aj</option>
                                                            <option value="mus_musculus_akrj">mus musculus akrj</option>
                                                            <option value="mus_musculus_balbcj">mus musculus balbcj
                                                            </option>
                                                            <option value="mus_musculus_c3hhej">mus musculus c3hhej
                                                            </option>
                                                            <option value="mus_musculus_c57bl6nj">mus musculus
                                                                c57bl6nj
                                                            </option>
                                                            <option value="mus_musculus_casteij">mus musculus casteij
                                                            </option>
                                                            <option value="mus_musculus_cbaj">mus musculus cbaj</option>
                                                            <option value="mus_musculus_dba2j">mus musculus dba2j
                                                            </option>
                                                            <option value="mus_musculus_fvbnj">mus musculus fvbnj
                                                            </option>
                                                            <option value="mus_musculus_lpj">mus musculus lpj</option>
                                                            <option value="mus_musculus_nodshiltj">mus musculus
                                                                nodshiltj
                                                            </option>
                                                            <option value="mus_musculus_nzohlltj">mus musculus
                                                                nzohlltj
                                                            </option>
                                                            <option value="mus_musculus_pwkphj">mus musculus pwkphj
                                                            </option>
                                                            <option value="mus_musculus_wsbeij">mus musculus wsbeij
                                                            </option>
                                                            <option value="mus_pahari">mus pahari</option>
                                                            <option value="mus_spicilegus">mus spicilegus</option>
                                                            <option value="mus_spretus">mus spretus</option>
                                                            <option value="mustela_putorius_furo">mustela putorius
                                                                furo
                                                            </option>
                                                            <option value="myotis_lucifugus">myotis lucifugus</option>
                                                            <option value="myripristis_murdjan">myripristis murdjan
                                                            </option>
                                                            <option value="naja_naja">naja naja</option>
                                                            <option value="nannospalax_galili">nannospalax galili
                                                            </option>
                                                            <option value="neogobius_melanostomus">neogobius
                                                                melanostomus
                                                            </option>
                                                            <option value="neolamprologus_brichardi">neolamprologus
                                                                brichardi
                                                            </option>
                                                            <option value="neovison_vison">neovison vison</option>
                                                            <option value="nomascus_leucogenys">nomascus leucogenys
                                                            </option>
                                                            <option value="notamacropus_eugenii">notamacropus eugenii
                                                            </option>
                                                            <option value="notechis_scutatus">notechis scutatus</option>
                                                            <option value="nothobranchius_furzeri">nothobranchius
                                                                furzeri
                                                            </option>
                                                            <option value="nothoprocta_perdicaria">nothoprocta
                                                                perdicaria
                                                            </option>
                                                            <option value="numida_meleagris">numida meleagris</option>
                                                            <option value="ochotona_princeps">ochotona princeps</option>
                                                            <option value="octodon_degus">octodon degus</option>
                                                            <option value="oncorhynchus_kisutch">oncorhynchus kisutch
                                                            </option>
                                                            <option value="oncorhynchus_mykiss">oncorhynchus mykiss
                                                            </option>
                                                            <option value="oncorhynchus_tshawytscha">oncorhynchus
                                                                tshawytscha
                                                            </option>
                                                            <option value="oreochromis_aureus">oreochromis aureus
                                                            </option>
                                                            <option value="oreochromis_niloticus">oreochromis
                                                                niloticus
                                                            </option>
                                                            <option value="ornithorhynchus_anatinus">ornithorhynchus
                                                                anatinus
                                                            </option>
                                                            <option value="oryctolagus_cuniculus">oryctolagus
                                                                cuniculus
                                                            </option>
                                                            <option value="oryzias_javanicus">oryzias javanicus</option>
                                                            <option value="oryzias_latipes">oryzias latipes</option>
                                                            <option value="oryzias_latipes_hni">oryzias latipes hni
                                                            </option>
                                                            <option value="oryzias_latipes_hsok">oryzias latipes hsok
                                                            </option>
                                                            <option value="oryzias_melastigma">oryzias melastigma
                                                            </option>
                                                            <option value="oryzias_sinensis">oryzias sinensis</option>
                                                            <option value="otolemur_garnettii">otolemur garnettii
                                                            </option>
                                                            <option value="otus_sunia">otus sunia</option>
                                                            <option value="ovis_aries">ovis aries</option>
                                                            <option value="ovis_aries_rambouillet">ovis aries
                                                                rambouillet
                                                            </option>
                                                            <option value="pan_paniscus">pan paniscus</option>
                                                            <option value="pan_troglodytes">pan troglodytes</option>
                                                            <option value="panthera_leo">panthera leo</option>
                                                            <option value="panthera_pardus">panthera pardus</option>
                                                            <option value="panthera_tigris_altaica">panthera tigris
                                                                altaica
                                                            </option>
                                                            <option value="papio_anubis">papio anubis</option>
                                                            <option value="parambassis_ranga">parambassis ranga</option>
                                                            <option value="paramormyrops_kingsleyae">paramormyrops
                                                                kingsleyae
                                                            </option>
                                                            <option value="parus_major">parus major</option>
                                                            <option value="pavo_cristatus">pavo cristatus</option>
                                                            <option value="pelodiscus_sinensis">pelodiscus sinensis
                                                            </option>
                                                            <option value="pelusios_castaneus">pelusios castaneus
                                                            </option>
                                                            <option value="periophthalmus_magnuspinnatus">periophthalmus
                                                                magnuspinnatus
                                                            </option>
                                                            <option value="peromyscus_maniculatus_bairdii">peromyscus
                                                                maniculatus bairdii
                                                            </option>
                                                            <option value="petromyzon_marinus">petromyzon marinus
                                                            </option>
                                                            <option value="phascolarctos_cinereus">phascolarctos
                                                                cinereus
                                                            </option>
                                                            <option value="phasianus_colchicus">phasianus colchicus
                                                            </option>
                                                            <option value="phocoena_sinus">phocoena sinus</option>
                                                            <option value="physeter_catodon">physeter catodon</option>
                                                            <option value="piliocolobus_tephrosceles">piliocolobus
                                                                tephrosceles
                                                            </option>
                                                            <option value="podarcis_muralis">podarcis muralis</option>
                                                            <option value="poecilia_formosa">poecilia formosa</option>
                                                            <option value="poecilia_latipinna">poecilia latipinna
                                                            </option>
                                                            <option value="poecilia_mexicana">poecilia mexicana</option>
                                                            <option value="poecilia_reticulata">poecilia reticulata
                                                            </option>
                                                            <option value="pogona_vitticeps">pogona vitticeps</option>
                                                            <option value="pongo_abelii">pongo abelii</option>
                                                            <option value="procavia_capensis">procavia capensis</option>
                                                            <option value="prolemur_simus">prolemur simus</option>
                                                            <option value="propithecus_coquereli">propithecus
                                                                coquereli
                                                            </option>
                                                            <option value="pseudonaja_textilis">pseudonaja textilis
                                                            </option>
                                                            <option value="pteropus_vampyrus">pteropus vampyrus</option>
                                                            <option value="pundamilia_nyererei">pundamilia nyererei
                                                            </option>
                                                            <option value="pygocentrus_nattereri">pygocentrus
                                                                nattereri
                                                            </option>
                                                            <option value="rattus_norvegicus">rattus norvegicus</option>
                                                            <option value="rhinolophus_ferrumequinum">rhinolophus
                                                                ferrumequinum
                                                            </option>
                                                            <option value="rhinopithecus_bieti">rhinopithecus bieti
                                                            </option>
                                                            <option value="rhinopithecus_roxellana">rhinopithecus
                                                                roxellana
                                                            </option>
                                                            <option value="saccharomyces_cerevisiae">saccharomyces
                                                                cerevisiae
                                                            </option>
                                                            <option value="saimiri_boliviensis_boliviensis">saimiri
                                                                boliviensis boliviensis
                                                            </option>
                                                            <option value="salarias_fasciatus">salarias fasciatus
                                                            </option>
                                                            <option value="salmo_salar">salmo salar</option>
                                                            <option value="salmo_trutta">salmo trutta</option>
                                                            <option value="salvator_merianae">salvator merianae</option>
                                                            <option value="sander_lucioperca">sander lucioperca</option>
                                                            <option value="sarcophilus_harrisii">sarcophilus harrisii
                                                            </option>
                                                            <option value="sciurus_vulgaris">sciurus vulgaris</option>
                                                            <option value="scleropages_formosus">scleropages formosus
                                                            </option>
                                                            <option value="scophthalmus_maximus">scophthalmus maximus
                                                            </option>
                                                            <option value="serinus_canaria">serinus canaria</option>
                                                            <option value="seriola_dumerili">seriola dumerili</option>
                                                            <option value="seriola_lalandi_dorsalis">seriola lalandi
                                                                dorsalis
                                                            </option>
                                                            <option
                                                                value="sinocyclocheilus_anshuiensis">sinocyclocheilus
                                                                anshuiensis
                                                            </option>
                                                            <option value="sinocyclocheilus_grahami">sinocyclocheilus
                                                                grahami
                                                            </option>
                                                            <option
                                                                value="sinocyclocheilus_rhinocerous">sinocyclocheilus
                                                                rhinocerous
                                                            </option>
                                                            <option value="sorex_araneus">sorex araneus</option>
                                                            <option value="sparus_aurata">sparus aurata</option>
                                                            <option value="spermophilus_dauricus">spermophilus
                                                                dauricus
                                                            </option>
                                                            <option value="sphaeramia_orbicularis">sphaeramia
                                                                orbicularis
                                                            </option>
                                                            <option value="sphenodon_punctatus">sphenodon punctatus
                                                            </option>
                                                            <option value="stachyris_ruficeps">stachyris ruficeps
                                                            </option>
                                                            <option value="stegastes_partitus">stegastes partitus
                                                            </option>
                                                            <option value="strigops_habroptila">strigops habroptila
                                                            </option>
                                                            <option value="strix_occidentalis_caurina">strix
                                                                occidentalis caurina
                                                            </option>
                                                            <option value="struthio_camelus_australis">struthio camelus
                                                                australis
                                                            </option>
                                                            <option value="suricata_suricatta">suricata suricatta
                                                            </option>
                                                            <option value="sus_scrofa">sus scrofa</option>
                                                            <option value="sus_scrofa_bamei">sus scrofa bamei</option>
                                                            <option value="sus_scrofa_berkshire">sus scrofa berkshire
                                                            </option>
                                                            <option value="sus_scrofa_hampshire">sus scrofa hampshire
                                                            </option>
                                                            <option value="sus_scrofa_jinhua">sus scrofa jinhua</option>
                                                            <option value="sus_scrofa_landrace">sus scrofa landrace
                                                            </option>
                                                            <option value="sus_scrofa_largewhite">sus scrofa
                                                                largewhite
                                                            </option>
                                                            <option value="sus_scrofa_meishan">sus scrofa meishan
                                                            </option>
                                                            <option value="sus_scrofa_pietrain">sus scrofa pietrain
                                                            </option>
                                                            <option value="sus_scrofa_rongchang">sus scrofa rongchang
                                                            </option>
                                                            <option value="sus_scrofa_tibetan">sus scrofa tibetan
                                                            </option>
                                                            <option value="sus_scrofa_usmarc">sus scrofa usmarc</option>
                                                            <option value="sus_scrofa_wuzhishan">sus scrofa wuzhishan
                                                            </option>
                                                            <option value="taeniopygia_guttata">taeniopygia guttata
                                                            </option>
                                                            <option value="takifugu_rubripes">takifugu rubripes</option>
                                                            <option value="terrapene_carolina_triunguis">terrapene
                                                                carolina triunguis
                                                            </option>
                                                            <option value="tetraodon_nigroviridis">tetraodon
                                                                nigroviridis
                                                            </option>
                                                            <option value="theropithecus_gelada">theropithecus gelada
                                                            </option>
                                                            <option value="tupaia_belangeri">tupaia belangeri</option>
                                                            <option value="tursiops_truncatus">tursiops truncatus
                                                            </option>
                                                            <option value="urocitellus_parryii">urocitellus parryii
                                                            </option>
                                                            <option value="ursus_americanus">ursus americanus</option>
                                                            <option value="ursus_maritimus">ursus maritimus</option>
                                                            <option value="ursus_thibetanus_thibetanus">ursus thibetanus
                                                                thibetanus
                                                            </option>
                                                            <option value="varanus_komodoensis">varanus komodoensis
                                                            </option>
                                                            <option value="vicugna_pacos">vicugna pacos</option>
                                                            <option value="vombatus_ursinus">vombatus ursinus</option>
                                                            <option value="vulpes_vulpes">vulpes vulpes</option>
                                                            <option value="xenopus_tropicalis">xenopus tropicalis
                                                            </option>
                                                            <option value="xiphophorus_couchianus">xiphophorus
                                                                couchianus
                                                            </option>
                                                            <option value="xiphophorus_maculatus">xiphophorus
                                                                maculatus
                                                            </option>
                                                            <option value="zalophus_californianus">zalophus
                                                                californianus
                                                            </option>
                                                            <option value="zonotrichia_albicollis">zonotrichia
                                                                albicollis
                                                            </option>
                                                            <option value="zosterops_lateralis_melanops">zosterops
                                                                lateralis melanops
                                                            </option>

                                                        </select>
                                                    </div>

                                                    <div className="mb-3">
                                                        <label htmlFor="annotation_release" className="form-label">Annotation
                                                            Release</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="annotation_release"
                                                            value={formDataEns.source_params.annotation_release.value}
                                                            onChange={handleChange}
                                                            placeholder="current"
                                                        />
                                                    </div>


                                                    <h5>Genomic Regions</h5>

                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                        <div className="col-md-4 mb-3" key={region}>
                                                            <div className="form-check">
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    id={region}
                                                                    name={region}
                                                                    checked={formDataEns.genomic_regions[region as keyof typeof formDataEns.genomic_regions]?.value === "true"} // ✅ FIXED
                                                                    onChange={(e) =>
                                                                        setFormDataEns((prev) => ({
                                                                            ...prev,
                                                                            genomic_regions: {
                                                                                ...prev.genomic_regions,
                                                                                [region]: {
                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                    value: e.target.checked ? "true" : "false",
                                                                                },
                                                                            },
                                                                        }))
                                                                    }
                                                                />
                                                                <label htmlFor={region} className="form-check-label">
                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {formDataEns.genomic_regions.exon_exon_junction.value === "true" && (
                                                        <div className="mb-3">
                                                            <label htmlFor="exon_exon_junction_block_size"
                                                                   className="form-label">
                                                                Exon-Exon-Junction Block Size
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                id="exon_exon_junction_block_size"
                                                                value={formDataEns.exon_exon_junction_block_size.value}
                                                                onChange={handleChange}
                                                                placeholder="50"
                                                            />
                                                        </div>
                                                    )}
                                                    <button type="submit" className="btn btn-primary">Submit

                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    {selectedSource === "custom" && (
                                        <div className="card shadow-sm mb-4 border-warning">
                                            <div className="card-header ">
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
                                                            value={formDataCustom.source_params.species.value}
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
                                                            value={formDataCustom.source_params.annotation_release.value}
                                                            onChange={handleChange}
                                                            placeholder=""
                                                        />
                                                    </div>
                                                    <div className="mb-3">
                                                        <label htmlFor="genome_assembly" className="form-label"> Genome
                                                            Assembly </label>
                                                        <input
                                                            type='text'
                                                            className="form-control"
                                                            id="genome_assembly"
                                                            value={formDataCustom.source_params.genome_assembly.value}
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
                                                            value={formDataCustom.source_params.files_source.value}
                                                            onChange={handleChange}
                                                            placeholder=""
                                                        />
                                                    </div>


                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                        <div className="col-md-4 mb-3" key={region}>
                                                            <div className="form-check">
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    id={region}
                                                                    name={region}
                                                                    checked={formDataCustom.genomic_regions[region as keyof typeof formDataCustom.genomic_regions]?.value === "true"}
                                                                    onChange={(e) =>
                                                                        setFormDataCustom((prev) => ({
                                                                            ...prev,
                                                                            genomic_regions: {
                                                                                ...prev.genomic_regions,
                                                                                [region]: {
                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                    value: e.target.checked ? "true" : "false",
                                                                                },
                                                                            },
                                                                        }))
                                                                    }
                                                                />
                                                                <label htmlFor={region} className="form-check-label">
                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {formDataCustom.genomic_regions.exon_exon_junction.value === "true" && (
                                                        <div className="mb-3">
                                                            <label htmlFor="exon_exon_junction_block_size"
                                                                   className="form-label">
                                                                Exon-Exon-Junction Block Size
                                                            </label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                id="exon_exon_junction_block_size"
                                                                value={formDataCustom.exon_exon_junction_block_size.value}
                                                                onChange={handleChange}
                                                                placeholder="50"
                                                            />
                                                        </div>
                                                    )}
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


