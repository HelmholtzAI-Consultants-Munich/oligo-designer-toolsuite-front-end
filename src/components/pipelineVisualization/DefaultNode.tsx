import type { NodeProps } from "@xyflow/react";
import { Position, Handle } from "@xyflow/react";
import { Card } from "react-bootstrap";
import type { DefaultNodeType } from "./types";

const DefaultNode = ({ data }: NodeProps<DefaultNodeType>) => {
    return (
        <div className="pipeline-step-node default-node-wrapper">
            <Card
                className="shadow-sm border-0"
                style={{
                    minWidth: "100px",
                    maxWidth: "150px",
                    borderRadius: "0.9rem",
                    background:
                        "linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)",
                }}
            >
                <Card.Header className="border-0 bg-transparent px-3 py-2">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                        <div>
                            <h6 className="mb-1 fw-semibold text-primary">
                                {data.label}
                            </h6>
                        </div>
                    </div>
                </Card.Header>
            </Card>
            {data.position === "start" ? (
                <Handle type="source" position={Position.Right} />
            ) : data.position === "end" ? (
                <Handle
                    className="no-handle"
                    type="target"
                    position={Position.Left}
                />
            ) : (
                ""
            )}
        </div>
    );
};

export default DefaultNode;
