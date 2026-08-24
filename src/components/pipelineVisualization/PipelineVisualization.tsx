import { useState, useCallback, useEffect, useRef, useMemo } from "react";

import {
    ReactFlow,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type OnConnect,
    type OnNodesChange,
    type OnEdgesChange,
    useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, type PipelineStepType } from "./types";
import type { PipelineStep } from "../../types";
import { BACKEND_URL } from "../../config";
import { useRuns } from "../../hooks/useRuns";
import { getNewId, getNewPosition } from "./utils";
import { viewportHeight } from "./constants";

/**
 *
 * @returns
 */

type PipelineVisualizationProps = {
    runId: string | undefined;
};
const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({
    runId,
}) => {
    const { screenToFlowPosition } = useReactFlow();
    const startNode: Node = useMemo(() => {
        return {
            id: "0",
            type: "defaultNode",
            position: screenToFlowPosition({ x: 20, y: 20 }),
            data: {
                name: "Start",
                type: "start",
            },
        };
    }, [screenToFlowPosition]);

    const initialNodes: Node[] = [startNode];
    const initialEdges: Edge[] = [];
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const connectingNodeRef = useRef<Node>(startNode);
    const { runs } = useRuns();
    const stepCountRef = useRef<number | undefined>(0);

    const run = useMemo(() => runs.find((r) => r._id === runId), [runs, runId]);

    const createNode = (
        id: string,
        xPosition: number,
        pipelineStep: PipelineStep
    ) => {
        const newNode: PipelineStepType = {
            id: id,
            position: { x: xPosition, y: 0 },
            type: "pipelineStep",
            data: {
                step_name: pipelineStep.step_name,
                num_oligos: pipelineStep.num_oligos,
                num_genes: pipelineStep.num_genes,
                parameters: pipelineStep.parameters,
                display_text: pipelineStep.display_text,
            },
        };
        return newNode;
    };

    const addNode = useCallback((newNode: Node, connectingNodeId: string) => {
        setNodes((nodes) => [...nodes, newNode]);
        setEdges((edges) =>
            addEdge(
                {
                    id: `${connectingNodeId} - ${newNode.id}`,
                    source: connectingNodeId,
                    target: newNode.id,
                },
                edges
            )
        );
    }, []);
    const onNodesChange: OnNodesChange = useCallback(
        (changes) =>
            setNodes((nodesSnapshot) =>
                applyNodeChanges(changes, nodesSnapshot)
            ),
        []
    );
    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) =>
            setEdges((edgesSnapshot) =>
                applyEdgeChanges(changes, edgesSnapshot)
            ),
        []
    );
    const onConnect: OnConnect = useCallback(
        (params: any) =>
            setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
        []
    );
    const processStep = useCallback(
        (step: PipelineStep, displayText?: string) => {
            const newNode = createNode(
                getNewId(connectingNodeRef.current.id),
                getNewPosition(connectingNodeRef.current.position.x),
                { ...step, display_text: displayText }
            );
            addNode(newNode, connectingNodeRef.current.id);
            connectingNodeRef.current = newNode;
        },
        [addNode]
    );

    useEffect(() => {
        if (run?.status === "success" && run.steps) {
            connectingNodeRef.current = startNode;
            // reset loading
            const newSteps = run?.steps?.slice(stepCountRef.current);
            newSteps?.forEach((step) => processStep(step, "after Run"));
            stepCountRef.current = run?.steps?.length;
        }
    }, [run, startNode, processStep]);

    useEffect(() => {
        if (run?.status === "started" && runId) {
            const es = new EventSource(BACKEND_URL + `/stream/${runId}`);
            es.onmessage = (event) => {
                const pipeline_step: PipelineStep = JSON.parse(event.data);
                processStep(pipeline_step, "from Stream");
                // set loading
            };
            return () => {
                es.close();
            };
        }
    }, [run?.status, runId, processStep]);

    return (
        <div style={{ height: viewportHeight }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
            />
        </div>
    );
};

export default PipelineVisualization;
