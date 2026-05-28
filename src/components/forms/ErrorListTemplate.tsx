import { type ErrorListProps } from "@rjsf/utils";
import { Card, ListGroup } from "react-bootstrap";

const errorId = (property: string) => {
    return "root" + property.replace(/\./g, "_") + "__error";
}

const scrollToError = (error: any) => {
    if (!error.property) {
        return;
    }

    const id = errorId(error.property);
    const errorElement = document.getElementById(id);
    if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

const ErrorListTemplate = (props: ErrorListProps) => {
    const { errors } = props;
    return (
        <Card id="rjsf-error-list" border='danger' className='mb-4'>
            <Card.Header className='alert-danger'>Form Errors</Card.Header>
            <Card.Body className='p-0'>
                <ListGroup>
                    {errors.map((error, i: number) => {
                        return (
                            <ListGroup.Item
                                key={i}
                                className='border-0'
                                action
                                onClick={() => scrollToError(error)}
                                role='button'
                                title='Click to jump to error'
                            >
                                <span className='text-danger'>{error.stack}</span>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            </Card.Body>
        </Card>
    );
}

export default ErrorListTemplate;
