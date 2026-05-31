import { Button, InputGroup } from "react-bootstrap";
import { Trash } from "react-bootstrap-icons";
import type { GenomicForm } from "./types";
import { FilePreview, GenomicFormPreview } from "./helpers";

type IntputListItem =
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
    inputs: IntputListItem[];
}

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
                title="Remove Form"
            >
                <Trash />
            </Button>
        </InputGroup>
    ));
};
