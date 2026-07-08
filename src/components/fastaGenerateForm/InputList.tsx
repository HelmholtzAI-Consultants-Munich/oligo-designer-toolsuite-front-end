import { Button, InputGroup } from "react-bootstrap";
import { Trash } from "react-bootstrap-icons";
import type { GenomicForm } from "./types";
import { FilePreview, GenomicFormPreview } from "./InputPreviews";

/**
 * Discriminated Union Type that describes possible entries of the InputList for the Genomic Region Input
 */
type InputListItem =
    | {
          type: "form";
          data: GenomicForm;
          editHandler: () => void;
          removeHandler: () => void;
      }
    | {
          type: "file";
          data: File;
          removeHandler: () => void;
      };

interface InputListProps {
    id: string;
    inputs: InputListItem[];
}

/**
 * Renders a list of Buttons which serve as short previews for the
 * selected Genomic Input (e.g. files, Genomic Region Generator Forms)
 * and as the way to open the corresponding edit menus.
 *
 * @param id - unique ID of the `InputList` Component
 * @param inputs - the current inputs of the Genomic Input Field
 * @returns A React Component rendering a List of Buttons to view
 * and edit Genomic Input
 */
export const InputList = ({ id, inputs }: InputListProps) => {
    return inputs.map((input, idx) => (
        <InputGroup key={`${id} ${idx}`} className="flex-nowrap">
            <Button
                variant="outline-border filled text-black"
                className="flex-grow-1"
                onClick={input.type === "form" ? input.editHandler : undefined}
            >
                {input.type === "form"
                    ? GenomicFormPreview(input.data as GenomicForm)
                    : FilePreview(input.data as File)}
            </Button>
            <Button
                variant="outline-border filled"
                onClick={input.removeHandler}
                title="Remove Region"
            >
                <Trash />
            </Button>
        </InputGroup>
    ));
};
