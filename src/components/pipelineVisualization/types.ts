import PipelineStepNode from "./PipelineStepNode";
import OligoInfoNode from "./OligoInfoNode";
import DefaultNode from "./DefaultNode";
import ErrorNode from "./ErrorNode";
import { type Node } from "@xyflow/react";

export const nodeTypes = {
    pipelineStep: PipelineStepNode,
    defaultNode: DefaultNode,
    error: ErrorNode,
    oligoInfo: OligoInfoNode,
};

export type DefaultNodeData = {
    label: string;
    position: string;
};

export type ErrorData = {
    type: "failure" | "timeout" | "empty_result";
    data: string;
};

export type OligoInfoData = {
    num_oligos: number;
    num_genes: number;
};

export type PipelineStep = {
    step_name: string;
    parameters: Record<string, unknown>;
};

export type ErrorNodeType = Node<ErrorData, "error">;

export type DefaultNodeType = Node<DefaultNodeData, "defaultNode">;

export type PipelineStepType = Node<PipelineStep, "pipelineStep">;

export type OligoInfoNodeType = Node<OligoInfoData, "oligoInfo">;

export type PipelineStepEvent = {
    type: "pipelineStep";
    data: PipelineStep;
};

export type PipelineErrorEvent = {
    type: "error";
    data: ErrorData;
};

export type DefaultEvent = {
    type: "default";
    data: DefaultNodeData;
};

export type OligoInfoEvent = {
    type: "oligoInfo";
    data: OligoInfoData;
};

export type PipelineEvent =
    | PipelineStepEvent
    | PipelineErrorEvent
    | DefaultEvent
    | OligoInfoEvent;
export type NodeType =
    | ErrorNodeType
    | PipelineStepType
    | OligoInfoNodeType
    | DefaultNodeType;
