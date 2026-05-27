import type { MultiSchemaFieldTemplateProps } from '@rjsf/utils';
import Card from 'react-bootstrap/Card';
import { ToolTip } from '../ui/Tooltip';

export default function MultiSchemaFieldTemplate(props: MultiSchemaFieldTemplateProps) {
    const { selector, optionSchemaField, schema } = props;
    return (
        <>
            {schema.description ? <ToolTip id={schema.$id!} tip={schema.description} /> : null}
            <Card style={{ marginBottom: '1rem', backgroundColor: 'var(--bs-primary-bg-subtle)' }}>
                <Card.Body>
                    <span className="super-label">{schema.title}</span>
                    <div className="multi-schema-selector">{selector}</div>
                    {optionSchemaField}
                </Card.Body>
            </Card>
        </>
    );
}
