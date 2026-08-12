import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { memo } from "react";
import Page from "../ui/Page";
import QuickSettingsPanel from "./QuickSettingsPanel";

/**
 * Layout to wrap all tabs and display only the active tab, each tab is rendered by a TabLayout
 *
 * @remarks
 * This component is used in the function `uiSchemaFromJsonSchemaRecursive`, which generates the uiSchema based on the JSON Schema
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout multiple tabs
 */
const TabsLayout = memo(function TabsLayout(props: ObjectFieldTemplateProps) {
    return (
        <QuickSettingsPanel>
            <Page.Tabs>
                {props.properties.map((element) => (
                    <Page.Tab tabKey={element.name} key={element.name}>
                        {element.content}
                    </Page.Tab>
                ))}
            </Page.Tabs>
        </QuickSettingsPanel>
    );
});

export default TabsLayout;
