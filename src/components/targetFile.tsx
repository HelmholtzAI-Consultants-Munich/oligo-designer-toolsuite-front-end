import { handleChange } from "./helpers";
import { formData } from "./types";

type Props = {
  setFormData: any;
  formData: formData;
};

const TargetFile: React.FC<Props> = ({ setFormData, formData }) => {
  return (
    <div className="flex-grow-1">
      <label htmlFor="file_regions_input" className="form-label">
        Target File:
      </label>
      <input
        type="text"
        className="form-control"
        id="file_regions_input"
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
  );
};
export default TargetFile;
