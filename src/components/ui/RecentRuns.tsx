import { Link, useLocation } from "react-router";
import { Nav } from "react-bootstrap";
import { useRuns } from "../../modules/useRuns";

const pipelineDisplayNames: Record<string, string> = {
    scrinshot: "Scrinshot",
    merfish: "Merfish",
    seqfish: "SeqFish+",
    oligoseq: "Oligo-Seq",
};

export default function RecentRuns() {
    const { runs } = useRuns();
    const location = useLocation();

    return (
        <>
            <Nav variant="heavy">
                {runs.slice(0, 3).map((run) => (
                    <Nav.Link
                        key={run._id} as={Link} to={`/runs/${run._id}`}
                        active={location.pathname.startsWith(`/runs/${run._id}`)}
                    >
                        <span>{run.status}</span>
                        {pipelineDisplayNames[run.pipeline] || run.pipeline}
                        <span>{new Date(run.timestamp).toLocaleString()}</span>
                    </Nav.Link>
                ))}
                {runs.length === 0 && <span>No recent runs</span>}
            </Nav>
            <Link to="/runs">View All Runs</Link>
        </>
    );
}
