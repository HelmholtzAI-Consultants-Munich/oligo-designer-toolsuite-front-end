import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { MarkerType } from "@xyflow/react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    nodeTypes,
    type PipelineEvent,
    type DefaultNodeType,
    type NodeType,
} from "./types";
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
    const startNode: DefaultNodeType = useMemo(() => {
        return {
            id: "0",
            type: "defaultNode",
            position: { x: 20, y: 20 },
            data: {
                label: "Start",
                position: "start",
            },
        };
    }, []);

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
        position: { x: number; y: number },
        pipelineEvent: PipelineEvent
    ) => {
        const newNode: NodeType = {
            id: id,
            position: position,
            type: pipelineEvent.type,
            data: pipelineEvent.data,
        } as NodeType;
        return newNode;
    };

    const markerStyle = {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: "#000000",
    };

    const addNode = useCallback((newNode: Node, connectingNodeId: string) => {
        setNodes((nodes) => [...nodes, newNode]);

        setEdges((edges) => {
            let newEdges = edges;
            const firstStep = "1";
            const lastStep = (parseInt(newNode.id) - 2).toString();
            const oligoDatabase = parseInt(newNode.id) % 2 === 0;

            if (oligoDatabase) {
                newEdges = addEdge(
                    {
                        id: `${connectingNodeId} - ${newNode.id} - oligoDatabase`,
                        source: connectingNodeId,
                        sourceHandle: "oligoDatabase",
                        target: newNode.id,
                    },
                    newEdges
                );
            } else {
                if (newNode.id == firstStep) {
                    newEdges = addEdge(
                        {
                            id: `${connectingNodeId} - ${newNode.id} - nextStep`,
                            source: connectingNodeId,
                            target: newNode.id,
                            markerEnd: markerStyle,
                        },
                        newEdges
                    );
                } else {
                    newEdges = addEdge(
                        {
                            id: `${lastStep} - ${newNode.id} - nextStep`,
                            source: lastStep,
                            sourceHandle: "nextStep",
                            target: newNode.id,
                            markerEnd: markerStyle,
                        },
                        newEdges
                    );
                }
            }

            return newEdges;
        });
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
        (event: PipelineEvent) => {
            const newNode = createNode(
                getNewId(connectingNodeRef.current.id),
                getNewPosition(
                    connectingNodeRef.current.id,
                    connectingNodeRef.current.position.x
                ),
                event
            );
            addNode(newNode, connectingNodeRef.current.id);
            connectingNodeRef.current = newNode;
        },
        [addNode]
    );

    // load steps from database if run is finished
    useEffect(() => {
        if (
            ["success", "failure", "timeout", "empty_result"].includes(
                run?.status ?? ""
            ) &&
            run?.events
        ) {
            connectingNodeRef.current = startNode;
            // reset loading
            const newSteps = run?.events?.slice(stepCountRef.current);
            newSteps?.forEach((step) => processStep(step));
            stepCountRef.current = run?.events?.length;
            if (
                run?.status === "success" &&
                connectingNodeRef.current !== startNode
            ) {
                processStep({
                    type: "default",
                    data: { label: "Finished", position: "end" },
                });
            }
        }
    }, [run, startNode, processStep]);

    // load steps from event stream if run is started
    useEffect(() => {
        if (run?.status === "started" && runId) {
            const es = new EventSource(BACKEND_URL + `/stream/${runId}`);
            es.onmessage = (event) => {
                const pipeline_event: PipelineEvent = JSON.parse(event.data);
                processStep(pipeline_event);

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
