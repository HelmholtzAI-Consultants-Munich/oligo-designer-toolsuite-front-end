import { Link } from "react-router";
import { Vertical } from "../components/ui/Alignment";

/**
 *
 * @returns A react functional component that renders a 404 error page.
 */
export default function NotFound() {
    return (
        <Vertical align="center" justify="center" className="vh-100">
            <h1>404 - PCR Failure</h1>
            <p>No amplification detected for this target URL.</p>
            <Link to="/">Return Home</Link>
        </Vertical>
    );
}
