// src/components/RunLocallyInfoBox.tsx
import React from "react";

interface RunLocallyInfoBoxProps {
  url?: string;
  text?: string;
}

const RunLocallyInfoBox: React.FC<RunLocallyInfoBoxProps> = ({
  url = "https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite?tab=readme-ov-file",
  text = "Want to run this pipeline locally?",
}) => (
  <div className="container my-4">
    <div className="alert alert-info mt-5 text-center">
      <strong>{text} </strong>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-primary"
      >
        View on GitHub
      </a>
    </div>
  </div>
);

export default RunLocallyInfoBox;