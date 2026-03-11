import { forwardRef, useState, type Ref } from "react";
import { BACKEND_URL } from "../../config";
import { useAuth } from "../../modules/useAuth";
import { Button, Dropdown, Nav } from "react-bootstrap";
import { GearFill } from "react-bootstrap-icons";
import { Link } from "react-router";

const UserDisplay = forwardRef(({ onClick } : { onClick: () => void }, ref: Ref<HTMLSpanElement>) => {
    const { user } = useAuth();
    
    return (
        <span ref={ref} onClick={onClick}>
            {user?.username || user?.helmholtz_sub || "Anonymous User"}
        </span>
    );
});

export default function UserDropdown() {
    const { user, logout } = useAuth();
    const [copied, setCopied] = useState(false);

    const handleLogout = () => {
        fetch(BACKEND_URL + "/logout", {
            method: "POST",
            credentials: "include",
        }).then(() => {
            logout();
        });
    };

    return (
        <>
            <Dropdown drop="up-centered">
                <Dropdown.Toggle as={UserDisplay} id="user-dropdown-toggle" />
                <Dropdown.Menu>
                    Test
                </Dropdown.Menu>
            </Dropdown>
            {user ? (
                <>
                    {user.role === "admin" && (
                        <Nav.Link as={Link} to="/admin">
                            Admin
                        </Nav.Link>
                    )}
                    <Nav.Item>
                        <Dropdown>
                            <Dropdown.Toggle>
                                <GearFill />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item
                                    className="dropdown-item-text px-3 py-2"
                                    style={{
                                        cursor: "pointer",
                                    }}
                                    onClick={() => {
                                        const textToCopy =
                                            user.helmholtz_sub ||
                                            user.username ||
                                            user.id;
                                        navigator.clipboard.writeText(
                                            textToCopy
                                        );
                                        setCopied(true);
                                        setTimeout(() => {
                                            setCopied(false);
                                        }, 2000);
                                    }}
                                    title="Click to copy"
                                >
                                    <small className="text-muted d-block mb-1">
                                        {copied ? (
                                            <span className="text-success">
                                                <i className="bi bi-check-circle-fill me-1"></i>
                                                Copied!
                                            </span>
                                        ) : (
                                            "User ID"
                                        )}
                                    </small>
                                    <code className="text-break mb-0 d-block">
                                        {user.helmholtz_sub ||
                                            user.username ||
                                            user.id}
                                    </code>
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={handleLogout}>
                                    Logout
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Nav.Item>
                </>
            ) : (
                <Nav.Item>
                    <Link to="/login">
                        <Button variant="primary">Login/Register</Button>
                    </Link>
                </Nav.Item>
            )}
        </>
    );
}
