import { Image} from "react-bootstrap";
import { Horizontal, Vertical } from "./Grid";

export default function Hero() {
    return (
        <Horizontal justify="center" className="my-5 hero">
            <Vertical>
                <Horizontal align="end">
                    <h1>
                        Welcome to the <br/>
                        Oligo Designer
                    </h1>
                    <Image
                        src="/ODT_logo.svg"
                        alt="Oligo Designer Toolsuite"
                        width="150"
                        height="150"
                    />
                </Horizontal>
                <Horizontal wrap gap="xl">
                    <h1>
                        Toolsuite
                    </h1>
                    <p className="lead fs-6 mt-4" style={{ maxWidth: "500px" }}>
                        Oligo Designer Toolsuite is an open-source framework designed to
                        streamline the development of custom oligonucleotide (oligo)
                        design pipelines. Oligos are short DNA or RNA sequences used in
                        various applications, such as research, diagnostics, and
                        therapeutics. The Toolsuite provides modular functionalities
                        like sequence generation, thermodynamic filtering, and machine
                        learning-based specificity prediction.
                    </p>
                </Horizontal>
            </Vertical>
        </Horizontal>
    )
}
