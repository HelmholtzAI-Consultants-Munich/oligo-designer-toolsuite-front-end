import { useCallback, useEffect, useState } from "react";
import { Button, Container, Form, InputGroup, Nav } from "react-bootstrap";
import { ArrowLeft, type Icon } from "react-bootstrap-icons";
import { Grid, Horizontal, Vertical } from "./Alignment";
import { useNavigate } from "react-router";

interface TabConfig {
    label: string;
    tabKey: string;
}

interface BackToConfig {
    label: string;
    href: string;
}

interface ButtonAction {
    type: "button";
    label: string;
    icon?: Icon;
    variant: string;
    onClick: () => void;
}

interface SearchAction {
    type: "search";
    label: string;
    placeholder: string;
    onSearch: (query: string) => void;
}

export type Action = ButtonAction | SearchAction;

export interface HeaderProps {
    title: string;
    metaTitle?: string; // overrides the title in the browser tab, defaults to title
    tabs?: TabConfig[];
    defaultTabKey?: string;
    actions?: Action[];
    backTo?: BackToConfig;
    hideHeader?: boolean;
    stickyHeader?: boolean;
}

function HeaderAction({ action }: { action: Action }) {
    const [query, setQuery] = useState("");

    if (action.type === "button") {
        return (
            <Vertical align="center" justify="end" fillHeight>
                {action.icon && (
                    <Form.Label
                        className="small text-muted text-center"
                        htmlFor={`action-${action.label.replace(/\s+/g, "-")}`}
                    >
                        {action.label}
                    </Form.Label>
                )}
                <Vertical.Item>
                    <Button
                        id={`action-${action.label.replace(/\s+/g, "-")}`}
                        variant={action.variant}
                        onClick={action.onClick}
                        className="icon-button"
                        title={action.label}
                    >
                        {action.icon ? <action.icon size={20} /> : action.label}
                    </Button>
                </Vertical.Item>
            </Vertical>
        );
    } else if (action.type === "search") {
        return (
            <Form
                onSubmit={(e) => {
                    e.preventDefault();
                    action.onSearch(query);
                }}
            >
                <InputGroup>
                    <Form.Control
                        placeholder={action.placeholder}
                        aria-label={action.label}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Button type="submit">{action.label}</Button>
                </InputGroup>
            </Form>
        );
    }
    return null;
}

function Header({
    title,
    metaTitle,
    tabs,
    defaultTabKey,
    actions,
    backTo,
    hideHeader,
    stickyHeader,
}: HeaderProps) {
    const extendedTitle = metaTitle || title + " | ODT Cloud";
    const [activeTab, setActiveTab] = useState(
        defaultTabKey || (tabs && tabs[0].tabKey) || ""
    );
    const [activeOffset, setActiveOffset] = useState([0, 0]);
    const [activeSize, setActiveSize] = useState([0, 0]);
    const [animationReady, setAnimationReady] = useState(0);
    const hasMeasuredActiveTab = activeSize[0] !== 0;

    const navigate = useNavigate();

    const measureActiveTab = useCallback(() => {
        const activeElement = document.querySelector(
            ".nav-header .nav-link.active"
        ) as HTMLElement;

        if (!activeElement) {
            return;
        }

        setActiveOffset([activeElement.offsetLeft, activeElement.offsetTop]);
        setActiveSize([activeElement.offsetWidth, activeElement.offsetHeight]);
    }, []);

    useEffect(() => {
        if (!hasMeasuredActiveTab && tabs && tabs.length > 0) {
            let cancelled = false;

            (async () => {
                await (document.fonts?.ready ?? Promise.resolve());

                if (cancelled) {
                    return;
                }

                requestAnimationFrame(() => {
                    if (cancelled) {
                        return;
                    }

                    measureActiveTab();
                    requestAnimationFrame(() => {
                        if (!cancelled) {
                            setAnimationReady(1); // Set animation ready flag after initial measurement
                        }
                    });
                });
            })();

            return () => {
                cancelled = true;
            };
        }
    }, [tabs, hasMeasuredActiveTab, measureActiveTab]);

    const handleResize = useCallback(() => {
        setAnimationReady(0); // Reset animation ready flag to prevent animation during resize
        measureActiveTab();
        requestAnimationFrame(() => {
            setAnimationReady(1); // Set animation ready flag after measurement
        });
    }, [measureActiveTab]);

    useEffect(() => {
        if (!tabs || tabs.length === 0) return; // No tabs, no need to set up resize listener

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [tabs, handleResize]);

    if (hideHeader) {
        return <title>{extendedTitle}</title>;
    }

    return (
        <>
            {stickyHeader && (
                <div className="sticky-header-title">
                    <Container>
                        <h1>{title}</h1>
                    </Container>
                </div>
            )}
            <header className={`header ${stickyHeader ? "sticky-header" : ""}`}>
                <title>{extendedTitle}</title>
                <div id="header-background">
                    <Container
                        className={stickyHeader ? "sticky-header-content" : ""}
                    >
                        {(tabs && tabs.length > 0 && (
                            <>
                                {!stickyHeader && (
                                    <h1 className="header-title">{title}</h1>
                                )}
                                <Horizontal align="end" wrap gap="lg">
                                    <Horizontal grow gap="md" align="center">
                                        {backTo && (
                                            <Button
                                                variant="outline-border"
                                                onClick={() =>
                                                    navigate(backTo.href)
                                                }
                                            >
                                                <ArrowLeft /> {backTo.label}
                                            </Button>
                                        )}
                                        <Nav
                                            variant="header"
                                            defaultActiveKey={
                                                defaultTabKey || tabs[0].tabKey
                                            }
                                            style={
                                                {
                                                    "--active-offset-x": `${activeOffset[0]}px`,
                                                    "--active-offset-y": `${activeOffset[1]}px`,
                                                    "--active-width": `${activeSize[0]}px`,
                                                    "--active-height": `${activeSize[1]}px`,
                                                    "--animation-ready":
                                                        animationReady,
                                                } as React.CSSProperties
                                            }
                                            onSelect={(_, event) => {
                                                const target = (
                                                    event?.target as HTMLElement
                                                ).closest(
                                                    ".nav-link"
                                                ) as HTMLElement;
                                                if (target) {
                                                    setActiveOffset([
                                                        target.offsetLeft,
                                                        target.offsetTop,
                                                    ]);
                                                    setActiveSize([
                                                        target.offsetWidth,
                                                        target.offsetHeight,
                                                    ]);
                                                }
                                            }}
                                        >
                                            {tabs.map((tab) => (
                                                <Nav.Item key={tab.tabKey}>
                                                    <Nav.Link
                                                        eventKey={tab.tabKey}
                                                        active={
                                                            tab.tabKey ===
                                                            activeTab
                                                        }
                                                        onClick={() =>
                                                            setActiveTab(
                                                                tab.tabKey
                                                            )
                                                        }
                                                        title={tab.label}
                                                    >
                                                        {tab.label}
                                                    </Nav.Link>
                                                </Nav.Item>
                                            ))}
                                        </Nav>
                                    </Horizontal>
                                    {actions && (
                                        <Grid gap="md">
                                            {actions.map((action, index) => {
                                                return (
                                                    <HeaderAction
                                                        key={index}
                                                        action={action}
                                                    />
                                                );
                                            })}
                                        </Grid>
                                    )}
                                </Horizontal>
                            </>
                        )) || (
                            <Horizontal align="end" wrap gap="md">
                                <Vertical gap="md" grow>
                                    <h1 className="header-title">{title}</h1>
                                    {backTo && (
                                        <Button
                                            variant="outline-border"
                                            onClick={() =>
                                                navigate(backTo.href)
                                            }
                                        >
                                            <ArrowLeft /> {backTo.label}
                                        </Button>
                                    )}
                                </Vertical>
                                {actions && (
                                    <Grid gap="md">
                                        {actions.map((action, index) => {
                                            return (
                                                <HeaderAction
                                                    key={index}
                                                    action={action}
                                                />
                                            );
                                        })}
                                    </Grid>
                                )}
                            </Horizontal>
                        )}
                    </Container>
                    {stickyHeader && <div className="sticky-header-spacer" />}
                </div>
            </header>
        </>
    );
}

export default Header;
