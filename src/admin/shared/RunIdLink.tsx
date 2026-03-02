import React from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

interface RunIdLinkProps {
    runId: string;
}

const RunIdLink: React.FC<RunIdLinkProps> = ({ runId }) => {
    const navigate = useNavigate();

    return (
        <Button
            variant="link"
            className="p-0 font-monospace text-decoration-none"
            onClick={() =>
                navigate(`/runs/${runId}`, {
                    state: { fromAdmin: true },
                })
            }
        >
            {runId}
        </Button>
    );
};

export default RunIdLink;
