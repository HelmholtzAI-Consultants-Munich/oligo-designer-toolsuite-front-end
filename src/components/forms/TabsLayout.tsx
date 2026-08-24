import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { Fragment, memo, useMemo } from "react";
import Page from "../ui/Page";
import QuickSettingsPanel from "./QuickSettingsPanel";
import { isHiddenTab } from "./utils";

/**
 * Layout to wrap all tabs and display only the active tab, each tab is rendered by a TabLayout
 *
 * @remarks
 * This component is used in the function `uiSchemaFromJsonSchemaRecursive`, which generates the uiSchema based on the JSON Schema
 *
 * The panels sit inside each pane, so a field portals into its own tab's panel: fields find
 * the nearest one above them in the tree, which is all that makes quick settings per-tab.
 *
 * @param props - ObjectFieldTemplateProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#objectfieldtemplate})
 * @returns A React Component that is used to overwrite the default ObjectFieldTemplate to layout multiple tabs
 */
const TabsLayout = memo(function TabsLayout(props: ObjectFieldTemplateProps) {
    const { panes, hidden } = useMemo(() => {
        const visible = props.properties.filter(
            (element) => !isHiddenTab(element.name)
        );
        // with nothing visible there is no first tab to hide them in, so give them panes
        return visible.length > 0
            ? {
                  panes: visible,
                  hidden: props.properties.filter((element) =>
                      isHiddenTab(element.name)
                  ),
              }
            : { panes: props.properties, hidden: [] };
    }, [props.properties]);

    return (
        <Page.Tabs>
            {panes.map((element, index) => (
                <Page.Tab tabKey={element.name} key={element.name}>
                    <QuickSettingsPanel>
                        {/* mounted here so their fields portal into the first tab's panels;
                            only the leftover markup needs hiding */}
                        {index === 0 && hidden.length > 0 && (
                            <div className="d-none">
                                {hidden.map((section) => (
                                    <Fragment key={section.name}>
                                        {section.content}
                                    </Fragment>
                                ))}
                            </div>
                        )}
                        {element.content}
                    </QuickSettingsPanel>
                </Page.Tab>
            ))}
        </Page.Tabs>
    );
});

export default TabsLayout;
