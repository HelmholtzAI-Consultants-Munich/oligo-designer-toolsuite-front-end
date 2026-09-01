import { defaultNodeWidth, offset, startNodeSpacing } from "./constants";

export const formatParameterName = (value: string): string => {
    const formatted = value.replaceAll("_", " ");

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export const getNewId = (id: string) => (parseInt(id) + 1).toString();

export const getNewPosition = (id: string, xPosition: number) => {
    const oligoDatabase = parseInt(id) % 2 == 0;
    const x =
        id == "0"
            ? xPosition + startNodeSpacing + offset
            : oligoDatabase
              ? xPosition + defaultNodeWidth + offset
              : xPosition;
    const y = oligoDatabase ? 0 : 150;
    return { x: x, y: y };
};
