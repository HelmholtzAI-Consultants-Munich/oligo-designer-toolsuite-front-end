import { Button, InputGroup } from "react-bootstrap";
import { Trash } from "react-bootstrap-icons";
import type { FastaFormUncommented } from "./types";

type Input = File | FastaFormUncommented;

interface InputListProps<T extends Input> {
    handleInputEdit?: (form: T, idx: number) => void;
    previewCallback: (inputList: T) => string;
    inputtedList: T[];
    id: string;
    handleInputRemove: (inputIndex: number) => void;
}
// TODO: Check if there is a more elegant solution to declaring a generic functional component
export const InputList = <T extends Input>({
    id,
    inputtedList,
    previewCallback,
    handleInputEdit,
    handleInputRemove,
}: InputListProps<T>) => {
    return inputtedList.map((input, idx) => (
        <InputGroup key={`${id} ${idx}`} className="flex-nowrap">
            <Button
                variant="outline-border"
                className="flex-grow-1"
                onClick={handleInputEdit ? () => handleInputEdit : undefined}
            >
                {previewCallback(input)}
            </Button>
            <Button
                variant="outline-border"
                onClick={() => handleInputRemove(idx)}
                title="Remove FASTA"
            >
                <Trash />
            </Button>
        </InputGroup>
    ));
};
