import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import Page from "../ui/Page";

/* Layout to wrap all tabs and display only the active tab, each tab is rendered by a TabLayout */
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
