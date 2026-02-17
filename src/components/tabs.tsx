import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";
import ObjectTemplate from "./objectTemplate";
import type { ObjectFieldTemplateProps } from "@rjsf/utils";

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
            <Tabs defaultActiveKey={tabs[0].title}>
                {tabs.map((tab) => (
                    <Tab eventKey={tab.title} title={tab.title} key={tab.title}>
                        <div className="p-3">
                            {tab.fields.map((entry: string | string[]) => {
                                if (Array.isArray(entry)) {
                                    return (
                                        <div
                                            key={entry.join("-")}
                                            className="d-flex gap-3"
                                        >
                                            {entry.map((field) => {
                                                const found =
                                                    props.properties.find(
                                                        (p) => p.name === field
                                                    );
                                                if (!found) return null;

                                                return (
                                                    <div key={field}>
                                                        {found.content}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                } else {
                                    const found = props.properties.find(
                                        (p) => p.name === entry
                                    );

                                    if (!found) return null;

                                    return (
                                        <div key={entry}>{found.content}</div>
                                    );
                                }
                            })}
                        </div>
                    </Tab>
                ))}
            </Tabs>
        );
    else {
        return <ObjectTemplate {...props} />;
    }
};
