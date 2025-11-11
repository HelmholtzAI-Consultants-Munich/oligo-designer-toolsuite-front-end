import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import { handleFileChange } from "./fileHelpers";
import { handleChange } from "./fileHelpers";

const TargetFile: React.FC = (setFormData: any, formData: any) => {
  return (
    <div className="mb-3">
      <label htmlFor="file_regions" className="form-label">
        Target File:
      </label>
      <div className="d-flex flex-column w-100">
        <div className="d-flex align-items-center w-100 gap-2">
          <input
            type="file"
            className="form-control visually-hidden"
            id="file_regions_file"
            name="file_regions_file"
            onChange={handleFileChange}
          />
          <div className="w-50">
            <input
              type="text"
              className="form-control"
              id="file_regions"
              name="file_regions"
              list="geneExamples"
              placeholder="Enter genes (comma-separated) or pick an example"
              onChange={(e) => handleChange(e, setFormData)}
              value={formData.file_regions.value}
            />

            <datalist id="geneExamples">
              <option value="AARS1" />
              <option value="ABCC1" />
              <option value="BCAR1" />
              <option value="LOC105376749" />
            </datalist>
          </div>
          <div className="w-50 d-flex align-items-center">
            <label
              htmlFor="file_regions_file"
              className="btn btn-outline-primary me-2 w-100"
              style={{ cursor: "pointer" }}
            >
              Choose File
            </label>
            <OverlayTrigger
              trigger="hover"
              placement="top"
              overlay={
                <Popover id="popover-n_jobs">
                  <Popover.Body>{formData.file_regions.comment}</Popover.Body>
                </Popover>
              }
            >
              <InfoCircle
                style={{
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#0d6efd",
                  marginLeft: "10px",
                }}
              />
            </OverlayTrigger>
          </div>
        </div>

        {/* Display selected file name under the icon */}
        <div className="text-muted small mt-1">
          {files.file_regions_file
            ? `Selected: ${files.file_regions_file.name}`
            : "No file selected"}
        </div>
      </div>

      <div className="mb-3 pt-3">
        <label
          htmlFor="files_fasta_target_probe_database"
          className="form-label"
        >
          Probe Database:
        </label>
        <div className="d-flex align-items-center w-100 gap-2">
          <div className="w-50">
            <button
              type="button"
              className="btn btn-outline-primary w-100"
              onClick={() =>
                setFastaForms((forms) => [...forms, { ...defaultFastaForm }])
              }
            >
              Generate FASTA+
            </button>
          </div>
          <div className="w-50 d-flex align-items-center">
            <input
              type="file"
              className="form-control visually-hidden"
              id="files_fasta_target_probe_database"
              name="files_fasta_target_probe_database"
              onChange={handleFileChange}
              multiple
            />
            <label
              htmlFor="files_fasta_target_probe_database"
              className="btn btn-outline-primary me-2 w-100"
            >
              Choose File
            </label>
            <OverlayTrigger
              trigger="hover"
              placement="top"
              overlay={
                <Popover id="files_fasta_target_probe_database">
                  <Popover.Body>
                    {formData.files_fasta_target_probe_database.comment}
                  </Popover.Body>
                </Popover>
              }
            >
              <InfoCircle
                style={{
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#0d6efd",
                  marginLeft: "10px",
                }}
              />
            </OverlayTrigger>
          </div>
        </div>
        <div className="text-muted small mt-1">
          {files.files_fasta_target_probe_database.length > 0
            ? `Selected: ${files.files_fasta_target_probe_database
                .map((f) => f.name)
                .join(", ")}`
            : "No files selected"}
        </div>
      </div>

      {fastaOption === "generate" && (
        <form onSubmit={handleSubmit}>
          {fastaForms.map((form, idx) => (
            <FastaGenerateForm
              key={idx}
              form={form}
              onChange={(updatedForm) =>
                setFastaForms((forms) =>
                  forms.map((f, i) => (i === idx ? updatedForm : f))
                )
              }
              onRemove={() =>
                setFastaForms((forms) =>
                  forms.length === 0 ? forms : forms.filter((_, i) => i !== idx)
                )
              }
              disableRemove={fastaForms.length === 0}
            />
          ))}
        </form>
      )}

      {/* Probe Reference Database input group */}
      <div className="mb-3 pt-3">
        <label
          htmlFor="files_fasta_reference_database_target_probe"
          className="form-label"
        >
          Probe Reference Database:
        </label>
        <div className="d-flex align-items-center w-100 gap-2">
          <div className="w-50">
            <button
              type="button"
              className="btn btn-outline-primary w-100"
              onClick={() =>
                setFastaFormsReference((forms) => [
                  ...forms,
                  { ...defaultFastaForm },
                ])
              }
            >
              Generate FASTA+
            </button>
          </div>
          <div className="w-50 d-flex align-items-center">
            <input
              type="file"
              className="form-control visually-hidden"
              id="files_fasta_reference_database_target_probe"
              name="files_fasta_reference_database_target_probe"
              onChange={handleFileChange}
              multiple
            />
            <label
              htmlFor="files_fasta_reference_database_target_probe"
              className="btn btn-outline-primary me-2 w-100"
            >
              Choose File
            </label>
            <OverlayTrigger
              trigger="hover"
              placement="top"
              overlay={
                <Popover id="files_fasta_reference_database_target_probe">
                  <Popover.Body>
                    {
                      formData.files_fasta_reference_database_target_probe
                        .comment
                    }
                  </Popover.Body>
                </Popover>
              }
            >
              <InfoCircle
                style={{
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#0d6efd",
                  marginLeft: "10px",
                }}
              />
            </OverlayTrigger>
          </div>
        </div>
        <div className="text-muted small mt-1">
          {files.files_fasta_reference_database_target_probe.length > 0
            ? `Selected: ${files.files_fasta_reference_database_target_probe
                .map((f) => f.name)
                .join(", ")}`
            : "No files selected"}
        </div>
      </div>
      {/* FASTA generation form for Probe Reference Database */}
      {fastaOption2 === "generate" && (
        <form onSubmit={handleSubmit}>
          {fastaFormsReference.map((form, idx) => (
            <FastaGenerateForm
              key={idx}
              form={form}
              onChange={(updatedForm) =>
                setFastaFormsReference((forms) =>
                  forms.map((f, i) => (i === idx ? updatedForm : f))
                )
              }
              onRemove={() =>
                setFastaFormsReference((forms) =>
                  forms.length === 0 ? forms : forms.filter((_, i) => i !== idx)
                )
              }
              disableRemove={fastaFormsReference.length === 0}
            />
          ))}
        </form>
      )}
    </div>
  );
};
export default TargetFile;
