import * as d3 from "d3"
import { useEffect } from "react";
import type { Oligo } from "../../pages/rundetail";
import ComponentDefinition from './oligoComponents.json';
import { reverseComplement } from "./helpers";

type Props ={
    oligos: Oligo[];
    pipeline: string;
    oligoIndex: number;
};

type OligoComponentDefinition = {
    type: "entry",
    field: string,
    isReverseComplement?: boolean,
    isBinding?: boolean,
    color: string,
    label: string,
} | {
    type: "sequence",
    value: string,
    color: string,
    label: string,
}

type OligoComponent = {
    sequence: string,
    color: string,
    label: string,
    isBinding: boolean,
}

type OligoBase = {
    char: string, // single character
    color: string,
    label: string,
    isBinding: boolean,
}

const OligoAlignment: React.FC<Props> = ({
    oligos,
    pipeline,
    oligoIndex
}) => {
    const components: OligoComponent[] = [];

    useEffect(() => {
        const svg = d3.select("#oligo")
        const group = svg.select("#oligo g")
        const zoomed = (e: any) => {
            const transform = e.transform
            const svgHeight = (svg.node() as SVGElement).getBoundingClientRect().height
            transform.y = svgHeight / 2
            group.attr('transform', transform)
        }
        const zoom = d3.zoom().on('zoom', zoomed)
        //@ts-expect-error -- d3 type definitions seem incorrect
        svg.call(zoom)
        const svgBox = (svg.node() as SVGElement).getBoundingClientRect()
        group.attr("transform", `translate(0, ${svgBox.height / 2})`)
    }, [oligos])

    const definition = (ComponentDefinition[(pipeline as keyof typeof ComponentDefinition)] as OligoComponentDefinition[]);

    if (!definition) {
        return <div>No visualization available for pipeline {pipeline}</div>
    }

    definition.forEach(componentDef => {
        if (componentDef.type === "entry") {
            let sequence = oligos[oligoIndex][componentDef.field as keyof Oligo][0][0] as string;
            if (componentDef.isReverseComplement) {
                sequence = reverseComplement(sequence);
            }
            components.push({
                sequence: sequence,
                color: componentDef.color,
                label: componentDef.label,
                isBinding: componentDef.isBinding ?? false,
            })
        } else if (componentDef.type === "sequence") {
            components.push({
                sequence: componentDef.value,
                color: componentDef.color,
                label: componentDef.label,
                isBinding: false,
            })
        }
    })

    const componentsToBases = (components: OligoComponent[]): OligoBase[] => {
        return components.map(component =>
            [...component.sequence].map(char => {
                return {
                    char,
                    color: component.color,
                    label: component.label,
                    isBinding: component.isBinding
                }
            })
        ).flat()
    }
    return(
        <>
            <svg id= "oligo" width="100%">
                <g>
                    {componentsToBases(components).map(
                        (base, index) => <text x={(index*12)} y={base.isBinding ? 10 : 0} style={{fill: base.color, textAnchor: "middle"}}>{base.char}</text>
                    )}
                </g>
            </svg>

            <div className="container mt-2 mb-4">
                <div className="row">
                    <div className="col col-auto">
                        <strong>Legend:</strong>
                    </div>
                    {Array.from(new Set(componentsToBases(components).map(base => base.label))).map((label, index) => {
                        const base = componentsToBases(components).find(base => base.label === label);
                        if (!base) return null;
                        return (
                            <div className="col col-auto" key={index}>
                                <span style={{display: "inline-block", width: "12px", height: "12px", backgroundColor: base.color, marginRight: "5px"}}></span>
                                {label}
                            </div>
                        )
                    })}
                </div>
            </div>
        </>
    );
};

export default OligoAlignment;
