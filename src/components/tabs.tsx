import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";
import ObjectTemplate from "./objectTemplate";

interface TabConfig {
    title: string;
    fields: Array<string | string[]>;
}

interface Property {
    name: string;
    content: React.ReactNode;
}

interface TabsLayoutProps {
    uiSchema: { "ui:tabs"?: TabConfig[] };
    fieldPathId: { $id: string };
    properties: Property[];
}

export const TabsLayout = (props: TabsLayoutProps) => {
    const { uiSchema } = props;
    const tabs = uiSchema["ui:tabs"];

    const isRoot = props.fieldPathId.$id === "root";
    if (isRoot)
        return (
            <Tabs defaultActiveKey={tabs[0].title}>
                {tabs.map((tab) => (
                    <Tab eventKey={tab.title} title={tab.title} key={tab.title}>
                        <div className="p-3">
                            {tab.fields.map((entry: string | string[]) => {
                                if (Array.isArray(entry)) {
                                    return (
                                        <div className="d-flex gap-3">
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
