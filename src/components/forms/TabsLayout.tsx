import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import Page from "../ui/Page";

const TabsLayout = memo(function TabsLayout(props: ObjectFieldTemplateProps) {
    return (
        <Page.Tabs>
            {props.properties.map((element) => (
                <Page.Tab tabKey={element.name} key={element.name}>
                    {element.content}
                </Page.Tab>
            ))}
        </Page.Tabs>
    );
});

export default TabsLayout;
