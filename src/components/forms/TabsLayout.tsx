import ObjectTemplate from "./ObjectTemplate";
import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import Page from "../ui/Page";
import { Horizontal, Vertical } from "../ui/Grid";
import { Fragment } from "react/jsx-runtime";

interface TabConfig {
    title: string;
    fields: Array<string | string[]>;
}

export const TabsLayout = (props: ObjectFieldTemplateProps) => {
    const { uiSchema } = props;
    const tabs = uiSchema?.["ui:tabs"] as TabConfig[] | undefined;

    const isRoot = props.fieldPathId.$id === "root";
    if (isRoot && tabs && tabs.length > 0)
        return (
            <Page.Tabs>
                {tabs.map((tab) => (
                    <Page.Tab tabKey={tab.title} key={tab.title}>
                        <Vertical gap="xl" align="stretch">
                            {tab.fields.map((entry: string | string[]) => {
                                if (Array.isArray(entry)) {
                                    return (
                                        <Horizontal
                                            key={entry.join("-")}
                                            gap="md"
                                            align="stretch"
                                        >
                                            {entry.map((field) => {
                                                const found =
                                                    props.properties.find(
                                                        (p) => p.name === field
                                                    );
                                                if (!found) return null;

                                                return (
                                                    <Horizontal.Item
                                                        grow
                                                        key={field}
                                                    >
                                                        {found.content}
                                                    </Horizontal.Item>
                                                );
                                            })}
                                        </Horizontal>
                                    );
                                } else {
                                    const found = props.properties.find(
                                        (p) => p.name === entry
                                    );

                                    if (!found) return null;

                                    return (
                                        <Fragment key={entry}>
                                            {found.content}
                                        </Fragment>
                                    );
                                }
                            })}
                        </Vertical>
                    </Page.Tab>
                ))}
            </Page.Tabs>
        );
    else {
        return <ObjectTemplate {...props} />;
    }
};
