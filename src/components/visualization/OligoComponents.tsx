import * as d3 from "d3";
import { useEffect, useMemo } from "react";
import ComponentDefinition from "./oligoComponents.json";
import { reverseComplement } from "./visualizationHelpers";
import type { Probe } from "../../types";
import { Horizontal } from "../ui/Alignment";

type Props = {
    probes: Probe[];
    selectedOligo: string;
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

const OligoComponents: React.FC<Props> = ({ probes, selectedOligo }) => {
    const oligo = probes.find((o) => o.oligo_id === selectedOligo);

    const components: OligoComponent[] = useMemo(() => {
        const componentList: OligoComponent[] = [];
        const pipeline = oligo?.pipeline;
        if (pipeline && Object.keys(ComponentDefinition).includes(pipeline)) {
            const components = ComponentDefinition[
                pipeline as keyof typeof ComponentDefinition
            ].components as OligoComponentDefinition[];
            components.forEach((componentDef) => {
                if (componentDef.type === "entry") {
                    let sequence = oligo.details[
                        componentDef.field as keyof Probe["details"]
                    ] as string;
                    if (componentDef.isReverseComplement) {
                        sequence = reverseComplement(sequence);
                    }
                    componentList.push({
                        sequence: sequence,
                        color: componentDef.color,
                        label: componentDef.label,
                        isBinding: componentDef.isBinding ?? false,
                    });
                } else if (componentDef.type === "sequence") {
                    componentList.push({
                        sequence: componentDef.value,
                        color: componentDef.color,
                        label: componentDef.label,
                        isBinding: false,
                    });
                }
            });
        }
        return componentList;
    }, [oligo]);

    const bases: OligoBase[] = components.flatMap((component) =>
        [...component.sequence].map((char) => {
            return {
                char,
                color: component.color,
                label: component.label,
                isBinding: component.isBinding,
            };
        })
    );

    const width = Math.max(12 * (bases.length + 2), 800);
    const height = 80;

    useEffect(() => {
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
            .scaleExtent([1, 3])
            .translateExtent([
                [0, height / 2],
                [width, height / 2],
            ])
            .on("zoom", zoomed);
        svg.attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("style", "width: 100%; height: auto;")
            .call(zoom)
            .on(
                "wheel",
                (event) => {
                    event.preventDefault();
                },
                { passive: false } // some browsers default to passive wheel listeners
            ); // prevent page scroll on zoom
        const svgBox = svgNode.getBoundingClientRect();
        group.attr("y", `${svgBox.height / 2}`);
    }, [components, width]);

    if (components.length === 0) {
        return (
            <div>No visualization available for pipeline {oligo?.pipeline}</div>
        );
    }

    if (!oligo) {
        return <div>Selected oligo not found.</div>;
    }

    const hasBindingAndNonBinding =
        components.some((c) => c.isBinding) &&
        components.some((c) => !c.isBinding);

    return (
        <>
            <svg id="oligo-components">
                <g>
                    {bases.map((base, index) => (
                        <text
                            x={width / 2 + (index - bases.length / 2) * 12}
                            y={
                                hasBindingAndNonBinding
                                    ? base.isBinding
                                        ? 45
                                        : 35
                                    : 40
                            }
                            style={{
                                fill: base.color,
                                textAnchor: "middle",
                                dominantBaseline: "middle",
                            }}
                            key={oligo.oligo_id + "-" + index}
                        >
                            {base.char}
                        </text>
                    ))}
                </g>
            </svg>

            <Horizontal align="center" wrap gap="md">
                <strong>Legend:</strong>
                {Array.from(new Set(bases.map((base) => base.label))).map(
                    (label, index) => {
                        const base = bases.find((base) => base.label === label);
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
                    }
                )}
            </Horizontal>
        </>
    );
};

export default OligoComponents;
