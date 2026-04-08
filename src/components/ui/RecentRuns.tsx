import { Link, useLocation } from "react-router";
import { Nav } from "react-bootstrap";
import { useRuns } from "../../modules/useRuns";
import { pipelineDisplayNames } from "./utils";
import { Horizontal } from "./Alignment";
import RunStatus from "./RunStatus";
import { ArrowRight } from "react-bootstrap-icons";

// TODO: update the timeAgo regularly (e.g. every minute) to keep it accurate without needing a page refresh
const timeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp); // ensure it's treated as UTC
    const diff = now.getTime() - past.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? "s" : ""} ago`;
};

export default function RecentRuns() {
    const { runs } = useRuns();
    const location = useLocation();

    return (
        <>
            <Nav variant="heavy">
                {runs.slice(0, 3).map((run) => (
                    <Nav.Link
                        key={run._id}
                        as={Link}
                        to={`/runs/${run._id}`}
                        active={location.pathname.startsWith(
                            `/runs/${run._id}`
                        )}
                    >
                        <Horizontal gap="lg" align="center">
                            <RunStatus status={run.status} />
                            <span>
                                {pipelineDisplayNames[run.pipeline] ||
                                    run.pipeline}
                            </span>
                            <span className="small text-muted">
                                {timeAgo(run.timestamp)}
                            </span>
                        </Horizontal>
                    </Nav.Link>
                ))}
                {runs.length === 0 && (
                    <span className="text-muted">No recent runs</span>
                )}
            </Nav>
            <Link to="/runs">
                All Runs <ArrowRight />
            </Link>
        </>
    );
}
