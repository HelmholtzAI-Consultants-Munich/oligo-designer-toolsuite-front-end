import { forwardRef, useState, type Ref } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button, Dropdown } from "react-bootstrap";
import { CheckCircleFill, Person } from "react-bootstrap-icons";

const UserDisplay = forwardRef(
    (
        {
            onClick,
            noUserCallback,
            fullWidth,
        }: {
            onClick: () => void;
            noUserCallback: () => void;
            fullWidth?: boolean;
        },
        ref: Ref<HTMLButtonElement>
    ) => {
        const auth = useAuth();
        const user = auth.user;

        return (
            <Button
                ref={ref}
                onClick={user ? onClick : noUserCallback}
                className={`${fullWidth ? "w-100 " : ""}user-dropdown filled`}
                variant="outline-border"
                aria-label={user ? "User menu" : "Login / Register"}
                title={user ? "User menu" : "Login / Register"}
            >
                <Person size={25} />
            </Button>
        );
    }
);

export default function UserDropdown({
    noUserCallback,
    fullWidth = true,
}: {
    noUserCallback: () => void;
    fullWidth?: boolean;
}) {
    const auth = useAuth();
    const user = auth.user;
    const { logoutWithConfirmation } = auth;
    const [copied, setCopied] = useState(false);

    return (
        <Dropdown drop={fullWidth ? "up-centered" : "down"} align="end">
            <Dropdown.Toggle
                as={UserDisplay}
                id="user-dropdown-toggle"
                noUserCallback={noUserCallback}
                fullWidth={fullWidth}
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
                        <Dropdown.Item onClick={logoutWithConfirmation}>
                            Logout
                        </Dropdown.Item>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    );
}
