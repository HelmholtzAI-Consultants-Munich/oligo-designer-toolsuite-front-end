import * as d3 from "d3";
import { useEffect } from "react";
import ComponentDefinition from "./oligoComponents.json";
import { reverseComplement } from "./helpers";
import type { Oligo } from "../../types";

type Props = {
    oligos: Oligo[];
    pipeline: string;
    oligoIndex: number;
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

const OligoAlignment: React.FC<Props> = ({ oligos, pipeline, oligoIndex }) => {
    const components: OligoComponent[] = [];

    const componentsToBases = (components: OligoComponent[]): OligoBase[] => {
        return components
            .map((component) =>
                [...component.sequence].map((char) => {
                    return {
                        char,
                        color: component.color,
                        label: component.label,
                        isBinding: component.isBinding,
                    };
                })
            )
            .flat();
    };

    const definition = ComponentDefinition[
        pipeline as keyof typeof ComponentDefinition
    ] as OligoComponentDefinition[];

    if (definition) {
        definition.forEach((componentDef) => {
            if (componentDef.type === "entry") {
                let sequence = oligos[oligoIndex][
                    componentDef.field as keyof Oligo
                ][0][0] as string;
                if (componentDef.isReverseComplement) {
                    sequence = reverseComplement(sequence);
                }
                components.push({
                    sequence: sequence,
                    color: componentDef.color,
                    label: componentDef.label,
                    isBinding: componentDef.isBinding ?? false,
                });
            } else if (componentDef.type === "sequence") {
                components.push({
                    sequence: componentDef.value,
                    color: componentDef.color,
                    label: componentDef.label,
                    isBinding: false,
                });
            }
        });
    }

    useEffect(() => {
        const width = 12 * (componentsToBases(components).length + 2);
        const height = 100;
        const margin = 20;

        const svg = d3.select("#oligo") as d3.Selection<
            Element,
            unknown,
            Element,
            unknown
        >;
        const group = svg.select("#oligo g");
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
        const svgBox = (svg.node() as SVGElement).getBoundingClientRect();
        group.attr("y", `${svgBox.height / 2}`);
    }, [components]);

    if (!definition) {
        return <div>No visualization available for pipeline {pipeline}</div>;
    }

    return (
        <>
            <svg id="oligo">
                <g>
                    {componentsToBases(components).map((base, index) => (
                        <text
                            x={(index + 1) * 12}
                            y={base.isBinding ? 55 : 45}
                            style={{ fill: base.color, textAnchor: "middle" }}
                        >
                            {base.char}
                        </text>
                    ))}
                </g>
            </svg>

            <div className="container mt-2 mb-4">
                <div className="row">
                    <div className="col col-auto">
                        <strong>Legend:</strong>
                    </div>
                    {Array.from(
                        new Set(
                            componentsToBases(components).map(
                                (base) => base.label
                            )
                        )
                    ).map((label, index) => {
                        const base = componentsToBases(components).find(
                            (base) => base.label === label
                        );
                        if (!base) return null;
                        return (
                            <div className="col col-auto" key={index}>
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
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default OligoAlignment;
