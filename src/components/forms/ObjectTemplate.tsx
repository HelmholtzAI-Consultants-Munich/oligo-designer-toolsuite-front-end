import { Col, Row } from "react-bootstrap";

interface ObjectProperty {
    name: string;
    content: React.ReactNode;
}

const ObjectTemplate = (props: { properties: ObjectProperty[] }) => {
    return (
        <Row>
            {props.properties.map((element) => (
                <Col md={6} key={element.name}>
                    {element.content}
                </Col>
            ))}
        </Row>
    );
};
export default ObjectTemplate;
