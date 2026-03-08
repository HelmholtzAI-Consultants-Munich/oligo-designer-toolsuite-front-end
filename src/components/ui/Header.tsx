import { Container } from "react-bootstrap";

function Header({ children }: { children: React.ReactNode }) {
    return (
        <header className="header">
            <Container>
                {children}
            </Container>
        </header>
    )
};

function HeaderTitle({ children }: { children: React.ReactNode }) {
    return (
        <h1 className="header-title">
            {children}
        </h1>
    )
};

Header.Title = HeaderTitle;

export default Header;
