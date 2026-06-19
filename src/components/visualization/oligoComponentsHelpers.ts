import type { Probe } from "../../types";
import { reverseComplement } from "./genomeAlignmentHelpers";

export type OligoComponent = {
    sequence: string;
    color: string;
    label: string;
    isBinding: boolean;
};

export type OligoComponentDefinition =
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

/**
 * Collects the oligo components for a given probe based on the provided component definitions.
 *
 * @param oligo The probe for which to collect the oligo components.
 * @param componentDefinitions The definitions of the oligo components, specifying how to extract each component from the probe.
 * @returns An array of OligoComponent object representing the collected oligo components.
 */
export const collectComponents = (
    oligo: Probe,
    componentDefinitions: OligoComponentDefinition[]
) => {
    const componentList: OligoComponent[] = [];
    componentDefinitions.forEach((componentDef) => {
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
    return componentList;
};
