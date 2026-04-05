import type { GenericObjectType } from "@rjsf/utils";

export type RJSFFormData = GenericObjectType;
export type RJSFFormDataKey = string;
export type Status = "idle" | "submitting" | "running";
export type Modal = {
    show: boolean;
    title: string;
    body: string;
};
