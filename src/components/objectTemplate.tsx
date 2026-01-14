const ObjectTemplate = (props: any) => {
    return (
        <div className="mb-4">
            <div className="row">
                {props.properties.map((element: any) => (
                    <div key={element.name} className="col-md-6 mb-3">
                        {element.content}
                    </div>
                ))}
            </div>
        </div>
    );
};
export default ObjectTemplate;
