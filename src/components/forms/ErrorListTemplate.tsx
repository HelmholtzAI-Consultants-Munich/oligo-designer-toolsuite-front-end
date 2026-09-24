import { type ErrorListProps, type RJSFValidationError } from "@rjsf/utils";
import { Button } from "react-bootstrap";
import { Card, ListGroup } from "react-bootstrap";
import { Arrow90degUp } from "react-bootstrap-icons";
import { filterUninformativeErrors } from "./utils";

const errorId = (property: string) => {
    return "root" + property.replace(/\./g, "_") + "__error";
};

// Bootstrap's collapse transition takes 0.35s, scrolling before it ends lands short
const COLLAPSE_TRANSITION_MS = 350;

/**
 * Opens every closed collapse around an element: the tab's accordion sections and the
 * `x-collapsed` groups, which start closed and hide their fields with `display: none`.
 *
 * @param element - the element to reveal
 * @returns A boolean that is True if a collapse had to be opened
 */
const openCollapsedAncestors = (element: HTMLElement): boolean => {
    let opened = false;
    let collapse = element.closest<HTMLElement>(".collapse:not(.show)");
    while (collapse) {
        // an x-collapsed group names its toggle by id, an accordion section's toggle heads it
        const toggle = collapse.id
            ? document.querySelector<HTMLElement>(
                  `[aria-controls="${collapse.id}"]`
              )
            : collapse.previousElementSibling?.querySelector<HTMLElement>(
                  ".accordion-button"
              );
        toggle?.click();
        opened ||= !!toggle;
        collapse =
            collapse.parentElement?.closest<HTMLElement>(
                ".collapse:not(.show)"
            ) ?? null;
    }
    return opened;
};

const scrollToError = (error: RJSFValidationError) => {
    if (!error.property) {
        return;
    }

    const id = errorId(error.property);
    const errorElement = document.getElementById(id);
    if (!errorElement) {
        return;
    }

    const scroll = () =>
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    if (openCollapsedAncestors(errorElement)) {
        setTimeout(scroll, COLLAPSE_TRANSITION_MS);
    } else {
        scroll();
    }
};

/**
 * This ErrorListTemplate is based on the react-bootstrap theme's template.
 * It adds a scroll-to-error functionality when clicking on an error message.
 *
 * @param props - ErrorListProps passed by RJSF (see {@link https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates/#errorlisttemplate})
 * @returns A React Component that is used to overwrite the default ErrorListTemplate
 */
const ErrorListTemplate = (props: ErrorListProps) => {
    const { errors } = props;
    return (
        <Card id="rjsf-error-list" border="danger" className="mt-4">
            <Card.Header className="border-0">
                Please correct the following errors:
            </Card.Header>
            <Card.Body className="p-0">
                <ListGroup
                    style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
                >
                    {errors
                        .filter((error) =>
                            filterUninformativeErrors(error.message || "")
                        )
                        .map((error, i: number) => {
                            return (
                                <ListGroup.Item
                                    key={i}
                                    className="border-0 border-top border-danger text-danger d-flex justify-content-between"
                                >
                                    {error.stack}
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => scrollToError(error)}
                                    >
                                        go to error
                                        <Arrow90degUp transform="scale(-1, 1)" />
                                    </Button>
                                </ListGroup.Item>
                            );
                        })}
                </ListGroup>
            </Card.Body>
        </Card>
    );
};

export default ErrorListTemplate;
