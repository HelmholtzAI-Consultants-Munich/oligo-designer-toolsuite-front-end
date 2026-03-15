import { useState } from "react";
import {
    Button,
    Container,
    Form,
    InputGroup,
    Nav,
} from "react-bootstrap";
import type { Icon } from "react-bootstrap-icons";
import { Horizontal, Vertical } from "./Grid";

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
                    {action.icon && <Form.Label className="small">{action.label}</Form.Label>}
                    <Vertical.Item>
                        <Form.Control as={Button} variant={action.variant} onClick={action.onClick}>
                            {action.icon ? <action.icon size={20} /> : action.label}
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

    if (hideHeader) {
        return <title>{extendedTitle}</title>;
    }

    return (
        <header className={`header ${stickyHeader ? "sticky-top" : ""}`}>
            <title>{extendedTitle}</title>
            <Container>
                {(tabs && tabs.length > 0 && (
                    <>
                        <h1 className="header-title">{title}</h1>
                        <Horizontal align="end" wrap>
                            <Horizontal.Item grow>
                                <Nav
                                    defaultActiveKey={
                                        defaultTabKey || tabs[0].tabKey
                                    }
                                >
                                    {tabs.map((tab) => (
                                        <Nav.Item key={tab.tabKey}>
                                            <Nav.Link eventKey={tab.tabKey}>
                                                {tab.label}
                                            </Nav.Link>
                                        </Nav.Item>
                                    ))}
                                </Nav>
                            </Horizontal.Item>
                            {actions && (
                                <Horizontal gap="md">
                                    {actions.map((action, index) => {
                                        return (
                                            <HeaderAction
                                                key={index}
                                                action={action}
                                            />
                                        );
                                    })}
                                </Horizontal>
                            )}
                        </Horizontal>
                    </>
                )) || (
                    <Horizontal align="end" wrap>
                        <Horizontal.Item grow>
                            <h1 className="header-title">{title}</h1>
                        </Horizontal.Item>
                        {actions && (
                            <Horizontal gap="md">
                                {actions.map((action, index) => {
                                    return (
                                        <HeaderAction
                                            key={index}
                                            action={action}
                                        />
                                    );
                                })}
                            </Horizontal>
                        )}
                    </Horizontal>
                )}
            </Container>
        </header>
    );
}

export default Header;
