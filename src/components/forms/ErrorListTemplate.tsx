import { type ErrorListProps, type RJSFValidationError } from "@rjsf/utils";
import { Card, ListGroup } from "react-bootstrap";
import { ArrowUp } from "react-bootstrap-icons";

const errorId = (property: string) => {
    return "root" + property.replace(/\./g, "_") + "__error";
};

const scrollToError = (error: RJSFValidationError) => {
    if (!error.property) {
        return;
    }

    const id = errorId(error.property);
    const errorElement = document.getElementById(id);
    if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
};

/**
 * This ErrorListTemplate is based on the react-bootstrap theme's template.
 * It adds a scroll-to-error functionality when clicking on an error message.
 */
const ErrorListTemplate = (props: ErrorListProps) => {
    const { errors } = props;
    return (
        <Card id="rjsf-error-list" border="danger" className="mt-4">
            <Card.Header className="alert-danger">
                Please correct the following errors (click to scroll to error):
            </Card.Header>
            <Card.Body className="p-0">
                <ListGroup>
                    {errors.map((error, i: number) => {
                        return (
                            <ListGroup.Item
                                key={i}
                                className="border-0"
                                action
                                onClick={() => scrollToError(error)}
                                role="button"
                                title="Click to scroll to error"
                            >
                                <span className="text-danger">
                                    <span className="text-decoration-underline">
                                        Scroll to error:
                                    </span>{" "}
                                    {error.stack}
                                </span>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            </Card.Body>
        </Card>
    );
};

export default ErrorListTemplate;
