export const isRootField = (fieldPathId: { $id: string }): boolean =>
    fieldPathId.$id === "root";

export const snakeCaseToTitleCase = (str: string): string =>
    str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

export const spaceBeforeCapitalLetters = (str: string): string =>
    str.replace(/([a-z])([A-Z])/g, "$1 $2");
