import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Position, Handle } from "@xyflow/react";
import { Badge, Button, Card, ListGroup } from "react-bootstrap";
import { formatParameterValue } from "./utils.tsx";
import type { PipelineStepType } from "./types.ts";

const PipelineStepNode = ({ data }: NodeProps<PipelineStepType>) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const parameterEntries = Object.entries(data.parameters ?? {});
    const isLoading = (data as any).isLoading === true;

    return (
        <div className="pipeline-step-node nowheel">
            <div className={isLoading ? "loading-border-container" : ""}>
                <Card
                    className="shadow-sm border-0"
                    style={{
                        minWidth: "200px",
                        maxWidth: "240px",
                        minHeight: "100px",
                        maxHeight: isExpanded ? "500px" : "100px",
                        borderRadius: "0.9rem",
                        overflow: "hidden",
                        background:
                            "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
                    }}
                >
                    <Card.Header className="border-0 bg-transparent px-3 py-2">
                        <div className="d-flex align-items-start justify-content-between gap-2">
                            <div>
                                <h6 className="mb-1 fw-semibold text-primary">
                                    {data.step_name}
                                </h6>
                                {data.display_text && (
                                    <p className="small text-muted mb-0">
                                        {data.display_text}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card.Header>
                    <Card.Body className="px-3 py-2 pt-0">
                        <div className="d-flex flex-wrap gap-2 mb-2">
                            <Badge bg="secondary-subtle" text="secondary">
                                {data.num_oligos} oligos
                            </Badge>
                            <Badge bg="info-subtle" text="info">
                                {data.num_genes} genes
                            </Badge>
                        </div>

                        {parameterEntries.length > 0 ? (
                            <>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <p className="small text-muted mb-0">
                                        Used parameters
                                    </p>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 text-primary"
                                        onClick={() =>
                                            setIsExpanded((value) => !value)
                                        }
                                    >
                                        {isExpanded ? "Hide" : "Show"}
                                    </Button>
                                </div>
                                {isExpanded && (
                                    <div
                                        style={{
                                            maxHeight: "300px",
                                            overflowY: "auto",
                                            paddingRight: "0.25rem",
                                        }}
                                    >
                                        <ListGroup
                                            variant="flush"
                                            className="small"
                                        >
                                            {parameterEntries.map(
                                                ([key, value]) => (
                                                    <ListGroup.Item
                                                        key={key}
                                                        className="px-0 py-1 border-0"
                                                    >
                                                        <span className="fw-semibold me-2">
                                                            {key}:
                                                        </span>
                                                        <span className="text-muted">
                                                            {formatParameterValue(
                                                                value
                                                            )}
                                                        </span>
                                                    </ListGroup.Item>
                                                )
                                            )}
                                        </ListGroup>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="small text-muted mb-0">
                                No parameters available.
                            </p>
                        )}
                    </Card.Body>
                </Card>

                <Handle type="target" position={Position.Left} />
                <Handle type="source" position={Position.Right} />
            </div>
        </div>
    );
};

export default PipelineStepNode;
