import type { NodeProps } from "@xyflow/react";
import { Position, Handle } from "@xyflow/react";
import { Badge, Card } from "react-bootstrap";
import type { OligoInfoNodeType } from "./types.ts";
import { FileCheck, CaretRight } from "react-bootstrap-icons";

const OligoInfoNode = ({ data }: NodeProps<OligoInfoNodeType>) => {
    return (
        <div className="pipeline-step-node nowheel">
            <Card
                className="shadow-sm border-0"
                style={{
                    minWidth: "200px",
                    maxWidth: "240px",
                    minHeight: "80px",
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
                                Oligo Database
                            </h6>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body className="px-3 py-2 pt-0">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                        <Badge bg="info-subtle" text="info" className="me-2">
                            {data.num_genes}{" "}
                            {data.num_genes === 1 ? "gene" : "genes"}
                        </Badge>

                        <Badge bg="info-subtle" text="info">
                            {data.num_oligos}{" "}
                            {data.num_oligos === 1 ? "oligo" : "oligos"}
                        </Badge>
                    </div>
                </Card.Body>
            </Card>

            <Handle type="target" position={Position.Top} />
        </div>
    );
};

export default OligoInfoNode;
