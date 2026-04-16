import { forwardRef, useState, type Ref } from "react";
import { BACKEND_URL } from "../../config";
import { useAuth } from "../../hooks/useAuth";
import { Button, Dropdown } from "react-bootstrap";
import {
    ArrowRight,
    CheckCircleFill,
    ChevronUp,
    Person,
} from "react-bootstrap-icons";
import { Horizontal } from "./Alignment";

const UserDisplay = forwardRef(
    (
        {
            onClick,
            noUserCallback,
        }: { onClick: () => void; noUserCallback: () => void },
        ref: Ref<HTMLButtonElement>
    ) => {
        const { user } = useAuth();

        return (
            <Button
                ref={ref}
                onClick={user ? onClick : noUserCallback}
                className="w-100 user-dropdown"
                variant="outline-border"
            >
                <Horizontal align="center" gap="sm">
                    <Horizontal.Item className="user-icon">
                        <Person size={25} />
                    </Horizontal.Item>
                    <Horizontal grow>
                        {user
                            ? user.username || user.helmholtz_sub
                            : "Login / Register"}
                    </Horizontal>
                    {user ? <ChevronUp size={15} /> : <ArrowRight size={15} />}
                </Horizontal>
            </Button>
        );
    }
);

export default function UserDropdown({
    noUserCallback,
}: {
    noUserCallback: () => void;
}) {
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
        <Dropdown drop="up-centered">
            <Dropdown.Toggle
                as={UserDisplay}
                id="user-dropdown-toggle"
                noUserCallback={noUserCallback}
            />
            <Dropdown.Menu>
                {user && (
                    <>
                        <Dropdown.ItemText
                            className="px-3 py-2"
                            style={{
                                cursor: "pointer",
                            }}
                            onClick={() => {
                                const textToCopy =
                                    user.helmholtz_sub ||
                                    user.username ||
                                    user.id;
                                navigator.clipboard.writeText(textToCopy);
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
                                        <CheckCircleFill
                                            size={14}
                                            className="me-1"
                                        />
                                        Copied!
                                    </span>
                                ) : (
                                    "User ID"
                                )}
                            </small>
                            <code className="text-break mb-0 d-block">
                                {user.helmholtz_sub || user.username || user.id}
                            </code>
                        </Dropdown.ItemText>
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={handleLogout}>
                            Logout
                        </Dropdown.Item>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    );
}
