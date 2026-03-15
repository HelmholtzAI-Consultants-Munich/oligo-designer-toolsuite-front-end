import { Horizontal } from "../ui/Grid";

interface ObjectProperty {
    name: string;
    content: React.ReactNode;
}

const ObjectTemplate = (props: { properties: ObjectProperty[] }) => {
    return (
        <Horizontal gap="lg" fillWidth>
            {props.properties.map((element) => (
                <Horizontal.Item grow key={element.name}>
                    {element.content}
                </Horizontal.Item>
            ))}
        </Horizontal>
    );
};
export default ObjectTemplate;
