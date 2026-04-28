export const isRootField = (fieldPathId: { $id: string }): boolean =>
    fieldPathId.$id === "root";
