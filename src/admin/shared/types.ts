import { Clock, CheckCircle, XCircle, PlayCircle } from 'react-bootstrap-icons';

/**
 * Status configuration for pipeline runs
 */
export const STATUS_CONFIG = {
    icons: {
        pending: Clock,
        started: PlayCircle,
        success: CheckCircle,
        failure: XCircle,
    },
    colors: {
        pending: "warning",
        started: "info",
        success: "success",
        failure: "danger",
    },
    labels: {
        pending: "Pending",
        started: "Started",
        success: "Success",
        failure: "Failure",
    },
} as const;
