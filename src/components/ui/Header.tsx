import { useEffect, useRef, useState } from "react";
import { Button, Container, Form, InputGroup, Nav } from "react-bootstrap";
import { ArrowLeft, type Icon } from "react-bootstrap-icons";
import { Grid, Horizontal, Vertical } from "./Grid";
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

type Action = ButtonAction | SearchAction;

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
            <Form.Group controlId={`header-action-${action.label}`}>
                <Vertical align="center">
                    {action.icon && (
                        <Form.Label className="small text-muted">
                            {action.label}
                        </Form.Label>
                    )}
                    <Vertical.Item>
                        <Form.Control
                            as={Button}
                            variant={action.variant}
                            onClick={action.onClick}
                            className="icon-button"
                        >
                            {action.icon ? (
                                <action.icon size={20} />
                            ) : (
                                action.label
                            )}
                        </Form.Control>
                    </Vertical.Item>
                </Vertical>
            </Form.Group>
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
    const [activeOffset, setActiveOffset] = useState(0);
    const [activeWidth, setActiveWidth] = useState(0);
    const [animationReady, setAnimationReady] = useState(0);
    const headerRef = useRef<HTMLDivElement | null>(null);
    const detectorRef = useRef<HTMLDivElement | null>(null);

    const navigate = useNavigate();

    // Set initial active tab offset and width on mount
    useEffect(() => {
        if (activeWidth === 0 && tabs && tabs.length > 0) {
            requestAnimationFrame(() => {
                const activeElement = document.querySelector(
                    `.nav-header .nav-link.active`
                ) as HTMLElement;
                if (activeElement) {
                    setActiveOffset(activeElement.offsetLeft);
                    setActiveWidth(activeElement.offsetWidth);
                }
                requestAnimationFrame(() => {
                    setAnimationReady(1); // Set animation ready flag after initial measurement
                });
            });
        }
    }, [tabs, activeWidth]);

    useEffect(() => {
        if (stickyHeader) {
            // TODO: make this logic more robust (and possibly efficient using IntersectionObserver)
            const handleScroll = () => {
                if (headerRef.current) {;
                    if (window.scrollY > 250) {
                        headerRef.current.classList.add("scrolled");
                    } else if (window.scrollY < 100) {
                        headerRef.current.classList.remove("scrolled");
                    }
                }
            }

            window.addEventListener("scroll", handleScroll);

            return () => {
                window.removeEventListener("scroll", handleScroll);
            }
        }
    }, [stickyHeader]);

    if (hideHeader) {
        return <title>{extendedTitle}</title>;
    }

    return (
        <>
            {stickyHeader && <div className="scroll-detector" ref={detectorRef}></div>}
            <header ref={headerRef} className={`header ${stickyHeader ? "sticky-top" : ""}`}>
                <title>{extendedTitle}</title>
                <Container>
                    {(tabs && tabs.length > 0 && (
                        <>
                            <h1 className="header-title">{title}</h1>
                            <Horizontal align="end" wrap>
                                <Horizontal grow gap="md" align="center">
                                    {backTo && (
                                        <Button
                                            variant="outline-border"
                                            onClick={() => navigate(backTo.href)}
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
                                                "--active-offset": `${activeOffset}px`,
                                                "--active-width": `${activeWidth}px`,
                                                "--animation-ready": animationReady,
                                            } as React.CSSProperties
                                        }
                                        onSelect={(selectedKey, event) => {
                                            const target =
                                                event?.target as HTMLElement;
                                            if (target) {
                                                setActiveOffset(target.offsetLeft);
                                                setActiveWidth(target.offsetWidth);
                                            }
                                        }}
                                    >
                                        {tabs.map((tab) => (
                                            <Nav.Item key={tab.tabKey}>
                                                <Nav.Link
                                                    eventKey={tab.tabKey}
                                                    active={
                                                        tab.tabKey === activeTab
                                                    }
                                                    onClick={() =>
                                                        setActiveTab(tab.tabKey)
                                                    }
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
                                        onClick={() => navigate(backTo.href)}
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
            </header>
        </>
    );
}

export default Header;
