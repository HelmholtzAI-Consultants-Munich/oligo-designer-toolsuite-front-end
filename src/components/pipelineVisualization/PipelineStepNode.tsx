import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Position, Handle } from "@xyflow/react";
import { Button, Card, ListGroup } from "react-bootstrap";
import { formatParameterName } from "./utils.tsx";
import type { PipelineStepType } from "./types.ts";
import FilterBox from "./FilterBox.tsx";

const PipelineStepNode = ({ data }: NodeProps<PipelineStepType>) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const parameterEntries = Object.entries(data.parameters ?? {});

    return (
        <div className="pipeline-step-node nowheel">
            <Card
                className="shadow-sm border-0"
                style={{
                    minWidth: "200px",
                    maxWidth: "260px",
                    minHeight: "80px",
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
                        </div>
                    </div>
                </Card.Header>
                <Card.Body className="px-3 py-2 pt-0">
                    {parameterEntries.length > 0 ? (
                        <>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <Button
                                    size="sm"
                                    variant="light"
                                    className="px-3 py-1 rounded-3 border-0 text-primary bg-info-subtle text-info"
                                    onClick={() =>
                                        setIsExpanded((value) => !value)
                                    }
                                >
                                    {isExpanded
                                        ? "Hide parameters"
                                        : "Show parameters"}
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
                                        <div>
                                            {Object.entries(
                                                data.parameters
                                            ).map(([key, value]) => {
                                                if (typeof value === "object") {
                                                    return (
                                                        <FilterBox
                                                            key={key}
                                                            title={key}
                                                            parameters={
                                                                value as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            }
                                                        />
                                                    );
                                                } else {
                                                    return (
                                                        <ListGroup.Item
                                                            key={key}
                                                            className="px-0 py-1 border-0"
                                                        >
                                                            <span className="fw-semibold me-2">
                                                                {formatParameterName(
                                                                    key
                                                                )}
                                                                :
                                                            </span>
                                                            <span className="text-muted">
                                                                {String(value)}
                                                            </span>
                                                        </ListGroup.Item>
                                                    );
                                                }
                                            })}
                                        </div>
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

            <Handle
                type="target"
                position={Position.Left}
                className="no-handle"
            ></Handle>
            <Handle type="source" position={Position.Right} id="nextStep" />

            <Handle
                type="source"
                position={Position.Bottom}
                id="oligoDatabase"
            />
        </div>
    );
};

export default PipelineStepNode;
