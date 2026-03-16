import * as d3 from "d3";
import { useEffect, useMemo } from "react";
import ComponentDefinition from "./oligoComponents.json";
import { reverseComplement } from "./helpers";
import type { Probe } from "../../types";
import { Horizontal } from "../ui/Grid";

type Props = {
    probes: Probe[];
    selectedOligo: string;
    setSelectedOligo: (id: string) => void;
};

type OligoComponentDefinition =
    | {
          type: "entry";
          field: string;
          isReverseComplement?: boolean;
          isBinding?: boolean;
          color: string;
          label: string;
      }
    | {
          type: "sequence";
          value: string;
          color: string;
          label: string;
      };

type OligoComponent = {
    sequence: string;
    color: string;
    label: string;
    isBinding: boolean;
};

type OligoBase = {
    char: string; // single character
    color: string;
    label: string;
    isBinding: boolean;
};

const OligoComponents: React.FC<Props> = ({
    probes,
    selectedOligo,
    setSelectedOligo,
}) => {
    const oligo = probes.find((o) => o.oligo_id === selectedOligo);

    const components: OligoComponent[] = useMemo(() => {
        const comps: OligoComponent[] = [];
        const pipeline = oligo?.pipeline;
        if (pipeline && Object.keys(ComponentDefinition).includes(pipeline)) {
            const definition = ComponentDefinition[
                pipeline as keyof typeof ComponentDefinition
            ] as OligoComponentDefinition[];
            definition.forEach((componentDef) => {
                if (componentDef.type === "entry") {
                    let sequence = oligo.details[
                        componentDef.field as keyof Probe["details"]
                    ] as string;
                    if (componentDef.isReverseComplement) {
                        sequence = reverseComplement(sequence);
                    }
                    comps.push({
                        sequence: sequence,
                        color: componentDef.color,
                        label: componentDef.label,
                        isBinding: componentDef.isBinding ?? false,
                    });
                } else if (componentDef.type === "sequence") {
                    comps.push({
                        sequence: componentDef.value,
                        color: componentDef.color,
                        label: componentDef.label,
                        isBinding: false,
                    });
                }
            });
        }
        return comps;
    }, [oligo]);

    const componentsToBases = (components: OligoComponent[]): OligoBase[] => {
        return components.flatMap((component) =>
            [...component.sequence].map((char) => {
                return {
                    char,
                    color: component.color,
                    label: component.label,
                    isBinding: component.isBinding,
                };
            })
        );
    };

    useEffect(() => {
        const width = 12 * (componentsToBases(components).length + 2);
        const height = 100;
        const margin = 20;

        const svg = d3.select("#oligo-components") as d3.Selection<
            Element,
            unknown,
            Element,
            unknown
        >;

        const svgNode = svg.node() as SVGElement | null;
        if (!svgNode) {
            return;
        }

        const group = svg.select("#oligo-components g");

        /* clear previous transforms */
        svg.call(d3.zoom().transform, d3.zoomIdentity);
        group.attr("transform", null);

        const zoomed = ({ transform }: { transform: d3.ZoomTransform }) => {
            group.attr("transform", transform.toString());
        };
        const zoom = d3
            .zoom()
            .scaleExtent([1, 5])
            .translateExtent([
                [-margin, 30],
                [width + margin, 70],
            ])
            .on("zoom", zoomed);
        svg.attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("style", "width: 100%; height: auto;")
            .call(zoom);
        const svgBox = svgNode.getBoundingClientRect();
        group.attr("y", `${svgBox.height / 2}`);
    }, [components]);

    if (components.length === 0) {
        return (
            <div>No visualization available for pipeline {oligo?.pipeline}</div>
        );
    }

    if (!oligo) {
        return <div>Selected oligo not found.</div>;
    }

    return (
        <>
            <label className="form-label" htmlFor="oligoSelect">
                Select Oligo
            </label>
            <select
                id="oligoSelect"
                className="form-select"
                value={selectedOligo}
                onChange={(e) => setSelectedOligo(e.target.value)}
            >
                {probes.map((oligo, index) => (
                    <option key={oligo.oligo_id} value={oligo.oligo_id}>
                        Oligo {index + 1}
                    </option>
                ))}
            </select>
            <svg id="oligo-components">
                <g>
                    {componentsToBases(components).map((base, index) => (
                        <text
                            x={(index + 1) * 12}
                            y={base.isBinding ? 55 : 45}
                            style={{ fill: base.color, textAnchor: "middle" }}
                            key={oligo.oligo_id + "-" + index}
                        >
                            {base.char}
                        </text>
                    ))}
                </g>
            </svg>

            <Horizontal align="center" wrap gap="md">
                <strong>Legend:</strong>
                {Array.from(
                    new Set(
                        componentsToBases(components).map((base) => base.label)
                    )
                ).map((label, index) => {
                    const base = componentsToBases(components).find(
                        (base) => base.label === label
                    );
                    if (!base) return null;
                    return (
                        <Horizontal key={index} align="baseline">
                            <span
                                style={{
                                    display: "inline-block",
                                    width: "12px",
                                    height: "12px",
                                    backgroundColor: base.color,
                                    marginRight: "5px",
                                }}
                            ></span>
                            {label}
                        </Horizontal>
                    );
                })}
            </Horizontal>
        </>
    );
};

export default OligoComponents;
