import * as d3 from "d3"
import { useEffect } from "react";
import type { Oligo } from "../../pages/rundetail";
import ComponentDefinition from './oligoComponents.json'

type Props ={
    oligos: Oligo[];
    pipeline: string;
};

type OligoComponents = {
    sequence: string,
    color: string,
    label: string,
    isBinding: boolean,
}[]

type OligoBases = {
    char: string, // single character
    color: string,
    label: string,
    isBinding: boolean,
}[]

const OligoAlignment: React.FC<Props> = ({
    oligos,
    pipeline
}) => {
    const components: OligoComponents = [];

    ComponentDefinition[pipeline].forEach(componentDef => {
        components.push({
            sequence: oligos[0][componentDef.field as keyof Oligo][0][0] as string,
            color: componentDef.color,
            label: componentDef.label,
            isBinding: componentDef.isBinding
        })
    })

    const componentsToBases = (components: OligoComponents): OligoBases => {
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
        //@ts-ignore
        svg.call(zoom)
        const svgBox = (svg.node() as SVGElement).getBoundingClientRect()
        group.attr("transform", `translate(0, ${svgBox.height / 2})`)

        console.log(oligos)
    }, [])
    return(
        <svg id= "oligo" width="100%">
            <g>
                {componentsToBases(components).map(
                    (base, index) => <text x={(index*12)} y="0" style={{fill: base.color, textAnchor: "middle"}}>{base.char}</text>
                )}
            </g>
        </svg>
    );
};

export default OligoAlignment;
