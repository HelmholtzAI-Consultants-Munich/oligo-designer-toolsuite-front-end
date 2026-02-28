import Navbar from "../components/ui/Navbar";

const index: React.FC = () => {
    return (
        <div>
            <Navbar />

            <div className="container my-5">
                <h1 className="mb-4">Introduction to the Python Framework</h1>
                <p>
                    The Oligo Designer Toolsuite is a collection of modules that
                    provide basic functionalities for custom oligo design
                    pipelines within a flexible Python framework. All modules
                    have a common underlying data structure and a standardized
                    API, which allows the user to easily combine different
                    modules depending on the required processing steps.
                </p>

                <div className="text-center my-4">
                    <img
                        src="/framework.png"
                        alt="Framework Overview"
                        className="img-fluid rounded shadow"
                    />
                </div>

                <h2>Data Model</h2>
                <p>
                    The underlying datastructure of the Oligo Designer Toolsuite
                    framework is constituted by the <code>OligoDatabase</code>{" "}
                    class. The <code>OligoDatabase</code> class comprises a{" "}
                    <code>database</code> attribute, metadata information of the
                    database content, and all related read, create, and write
                    functionalities for the database.
                </p>

                <pre className="bg-light p-3 rounded">
                    <code>
                        {`{
  "region_id": {
    "oligo_id": {
      "sequence": Seq("GAACTCAagaggaaaaaaatccagTACTTGACTCGTGG"),
      "chromosome": "6",
      "start": [26373289, ...],
      "end": [26374330, ...],
      "strand": "+",
      "length": 38,
      "additional_information_fasta": [
        "transcript_id=XM_047418113.1,exon_number=9;..."
      ],
      "GC_content": 52.0
    }
  }
}`}
                    </code>
                </pre>

                <h2>Working Principle</h2>
                <p>
                    On a higher level, the package is structured in a way that
                    the modules resemble the individual processing steps of a
                    custom oligo design pipeline:
                </p>
                <ul>
                    <li>
                        <strong>Database:</strong> generation of FASTA files for
                        specific genomic regions
                    </li>
                    <li>
                        <strong>Oligo Property Filters:</strong> filtering
                        oligos based on specific properties
                    </li>
                    <li>
                        <strong>Oligo Specificity Filters:</strong> filtering
                        oligos with high off-target hits
                    </li>
                    <li>
                        <strong>Oligo Efficiency Filters:</strong> filtering
                        low-efficiency oligos
                    </li>
                    <li>
                        <strong>Oligo Selection:</strong> generation of oligo
                        sets fulfilling experiment-specific criteria
                    </li>
                    <li>
                        <strong>Sequence Design:</strong> designing final
                        experiment-specific oligo sequences
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default index;
