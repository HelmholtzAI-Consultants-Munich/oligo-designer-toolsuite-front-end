import { Container, Tab } from "react-bootstrap";
import Header, { type HeaderProps } from "./Header";

interface PageProps extends HeaderProps {
    children: React.ReactNode;
}

function Page({
    title,
    metaTitle,
    tabs,
    defaultTabKey,
    actions,
    hideHeader,
    children,
}: PageProps) {
    if (!tabs || tabs.length === 0) {
        return (
            <>
                <Header
                    title={title}
                    metaTitle={metaTitle}
                    actions={actions}
                    hideHeader={hideHeader}
                />
                <Container className="page">{children}</Container>
            </>
        );
    }

    return (
        <Tab.Container defaultActiveKey={defaultTabKey || tabs[0].tabKey}>
            <Header
                title={title}
                metaTitle={metaTitle}
                tabs={tabs}
                defaultTabKey={defaultTabKey}
                actions={actions}
                hideHeader={hideHeader}
            />
            <Container className="page">{children}</Container>
        </Tab.Container>
    );
}

function PageTab({
    tabKey,
    children,
}: {
    tabKey: string;
    children: React.ReactNode;
}) {
    return <Tab.Pane eventKey={tabKey}>{children}</Tab.Pane>;
}

function PageTabs({ children }: { children: React.ReactNode }) {
    return <Tab.Content>{children}</Tab.Content>;
}

Page.Tab = PageTab;
Page.Tabs = PageTabs;

export default Page;
