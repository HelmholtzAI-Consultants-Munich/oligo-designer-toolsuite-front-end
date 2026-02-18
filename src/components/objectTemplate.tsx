interface ObjectProperty {
    name: string;
    content: React.ReactNode;
}

const ObjectTemplate = (props: { properties: ObjectProperty[] }) => {
    return (
        <div className="mb-4">
            <div className="row">
                {props.properties.map((element) => (
                    <div key={element.name} className="col-md-6 mb-3">
                        {element.content}
                    </div>
                ))}
            </div>
        </div>
    );
};
export default ObjectTemplate;
