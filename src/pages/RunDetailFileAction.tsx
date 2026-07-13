import type { FileDownloadEntry } from "../components/ui/Header";
import { downloadFileFactory } from "../utils/fileDownloadUtil";
import { Button } from "react-bootstrap";
import { Horizontal } from "../components/ui/Alignment";

interface RunDetailFileActionsProps {
    actions: FileDownloadEntry[];
}

/**
 * Generates file download actions for the run detail page.
 * @param actions - An array of file download entries containing label, URL, and optional icon and filename.
 * @returns A React functional component that renders buttons for each file download action.
 */
const RunDetailFileAction: React.FC<RunDetailFileActionsProps> = ({
    actions,
}) => {
    return (
        <Horizontal gap="md">
            {actions.map((action) => (
                <Button
                    variant="outline-primary"
                    title={action.label}
                    onClick={downloadFileFactory(
                        action.label,
                        action.url,
                        action.fileName
                    )}
                >
                    {action.icon && <action.icon size={20} />} {action.label}
                </Button>
            ))}
        </Horizontal>
    );
};

export default RunDetailFileAction;
