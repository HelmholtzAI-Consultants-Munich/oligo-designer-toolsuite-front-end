import { useNavigate } from "react-router";
import { Button, Image } from "react-bootstrap";
import { ArrowRight, BoxArrowUpRight } from "react-bootstrap-icons";
import { Horizontal, Vertical } from "./Alignment";

export default function Hero() {
    const navigate = useNavigate();

    return (
        <Horizontal
            justify="start"
            align="center"
            wrap
            fillWidth
            gap="xl"
            className="my-5 hero"
        >
            <Vertical gap="md">
                <h1>
                    Welcome to the <br />
                    <span className="text-odt-blue">
                        Oligo Designer Toolsuite
                    </span>
                </h1>
                <p
                    className="lead fs-4 fw-bold text-muted mb-0"
                    style={{ maxWidth: "500px" }}
                >
                    Design oligonucleotide probe sets through reproducible cloud
                    workflows.
                </p>
                <p
                    className="fs-6 text-muted mb-0"
                    style={{ maxWidth: "500px" }}
                >
                    Generate probe sets for OligoSeq, MERFISH, SEQFISH,
                    SCRINSHOT, cycleHCR and HCR directly from genomic
                    annotations.
                </p>
                <Horizontal wrap gap="md">
                    <Button
                        onClick={() => navigate("/pipelines")}
                        variant="odt-blue"
                    >
                        Start Designing <ArrowRight className="ms-1" />
                    </Button>
                    <Button
                        variant="outline-primary"
                        href="https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Documentation <BoxArrowUpRight className="ms-1" />
                    </Button>
                </Horizontal>
            </Vertical>
            <Image
                src="/odt-logo.svg"
                alt="Oligo Designer Toolsuite"
                width="200"
                height="200"
            />
        </Horizontal>
    );
}
