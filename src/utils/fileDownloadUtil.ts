import axios from "axios";
import { showToast } from "./toastUtil";

export interface downloadErrorMessage {
    title: string;
    content: string;
}

export async function downloadFile(
    url: string,
    fileName: string,
    errorMessages: {
        notFound: downloadErrorMessage;
        general: downloadErrorMessage;
    }
) {
    try {
        const response = await axios.get(url, {
            withCredentials: true,
            responseType: "blob",
        });

        const blobURL = URL.createObjectURL(
            new Blob([response.data], { type: response.data.type })
        );

        const link = document.createElement("a");
        link.href = blobURL;
        link.download = fileName;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobURL);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            showToast({
                ...errorMessages.notFound,
                type: "danger",
            });
        } else {
            showToast({
                ...errorMessages.general,
                type: "danger",
            });
        }
    }
}

/**
 * Creates a download function for a specific file with given label, URL, and file name.
 * @param label The label for the file.
 * @param url The URL of the file to download.
 * @param fileName The name of the file to download.
 * @returns A function that triggers the file download.
 */
export const downloadFileFactory =
    (label: string, url: string, fileName: string) => () => {
        downloadFile(url, fileName, {
            notFound: {
                title: `File for ${label} is not available`,
                content: "The requested file was not found for this run",
            },
            general: {
                title: `Failed to Load File for ${label}`,
                content:
                    "An error occurred while fetching the file. Please try again.",
            },
        });
    };
