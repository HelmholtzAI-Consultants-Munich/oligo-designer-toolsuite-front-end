import { Col, Row, Tab, Tabs } from "react-bootstrap";
import ObjectTemplate from "./ObjectTemplate";
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
                        {tab.fields.map((entry: string | string[]) => {
                            if (Array.isArray(entry)) {
                                return (
                                    <Row key={entry.join("-")}>
                                        {entry.map((field) => {
                                            const found = props.properties.find(
                                                (p) => p.name === field
                                            );
                                            if (!found) return null;

                                            return (
                                                <Col key={field}>
                                                    {found.content}
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                );
                            } else {
                                const found = props.properties.find(
                                    (p) => p.name === entry
                                );

                                if (!found) return null;

                                return <Col key={entry}>{found.content}</Col>;
                            }
                        })}
                    </Tab>
                ))}
            </Tabs>
        );
    else {
        return <ObjectTemplate {...props} />;
    }
};
