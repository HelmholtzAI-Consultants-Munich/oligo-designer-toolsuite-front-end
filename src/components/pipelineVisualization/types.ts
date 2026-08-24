import type { PipelineStep } from "../../types";
import PipelineStepNode from "./PipelineStepNode";
import DefaultNode from "./DefaultNode";
import { type Node } from "@xyflow/react";

export const nodeTypes = {
    pipelineStep: PipelineStepNode,
    defaultNode: DefaultNode,
};

export type DefaultNodeData = {
    name: string;
    type: string;
};
export type DefaultNodeType = Node<DefaultNodeData, "defaultNode">;

export type PipelineStepType = Node<PipelineStep, "pipelineStep">;
