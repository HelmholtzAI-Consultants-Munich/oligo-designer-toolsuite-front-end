import { Alert } from "react-bootstrap";
import { Link } from "react-router";

interface ErrorAlertProps {
    /** Bootstrap variant, usually taken from `runStatusDisplay`. */
    variant: string;
    /** Rendered before the title. Accepts bootstrap icons and `Pulse` alike. */
    icon: React.ElementType;
    title: string;
    /** What went wrong, in the user's terms; raw errors belong in the console. */
    children: React.ReactNode;
}

/**
 * The page-level box reporting that something failed, with the contact note every such
 * report carries.
 *
 * @param props - the variant, icon and title to head the alert with, over the message
 * @returns A React Component holding the message above a note on how to reach us
 */
export default function ErrorAlert({
    variant,
    icon: Icon,
    title,
    children,
}: ErrorAlertProps) {
    return (
        <Alert
            variant={variant}
            className="mx-auto mt-5"
            style={{ width: "30rem", maxWidth: "100%" }}
        >
            <Alert.Heading className="text-center fs-3 mb-4 mt-2">
                <Icon /> {title}
            </Alert.Heading>
            {children}
            <hr />
            <p className="small text-muted mb-0">
                To contact us about this issue, use the "Feedback" button (when
                logged in) or find our contact information{" "}
                <Link to="/contact" className="text-decoration-underline">
                    here
                </Link>
                .
            </p>
        </Alert>
    );
}
