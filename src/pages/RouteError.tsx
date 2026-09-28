import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { runStatusDisplay } from "../components/ui/utils";
import ErrorAlert from "../components/ui/ErrorAlert";
import NotFound from "./404";

/**
 * Route-level error element. React Router routes every render error here, not just unmatched
 * URLs, so rendering the 404 page unconditionally reported crashes as missing pages.
 *
 * The thrown error is not shown: React Router already logs it to the console for developers,
 * and users get a sanitized message, as everywhere else (see `errorHandler.ts`).
 *
 * @returns The 404 page for an unmatched URL, otherwise a page reporting that the page failed
 */
export default function RouteError() {
    const error = useRouteError();

    // Only React Router's own 404 response means the URL matched no route.
    if (isRouteErrorResponse(error) && error.status === 404) {
        return <NotFound />;
    }

    const { variant, icon } = runStatusDisplay.failure;

    return (
        <ErrorAlert variant={variant} icon={icon} title="Something Went Wrong">
            This page could not be displayed. Reloading it usually helps; if it
            does not, <Link to="/">return home</Link> and try again.
        </ErrorAlert>
    );
}
