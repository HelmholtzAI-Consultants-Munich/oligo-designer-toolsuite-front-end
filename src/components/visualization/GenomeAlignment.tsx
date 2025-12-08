import type { Oligo } from "../../types";

type Props = {
    oligos: Oligo[];
}

const GenomeAlignment: React.FC<Props> = ({ oligos }) => {
    return (
        <p>Genome Alignment Vis</p>
    );
}

export default GenomeAlignment;
