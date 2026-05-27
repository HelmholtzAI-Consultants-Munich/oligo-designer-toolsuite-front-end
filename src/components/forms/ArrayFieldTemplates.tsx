import { descriptionId, titleId, type ArrayFieldDescriptionProps, type ArrayFieldTitleProps } from '@rjsf/utils';
import { ToolTip } from '../ui/Tooltip';

const ArrayFieldTitleTemplate = (props: ArrayFieldTitleProps) => {
    const { title, fieldPathId } = props;
    const id = titleId(fieldPathId);
    return <span id={id} className="super-label">
        {title}
    </span>;
}

const ArrayFieldDescriptionTemplate = (props: ArrayFieldDescriptionProps) => {
    const { description, fieldPathId } = props;
    const id = descriptionId(fieldPathId);

    if (!description) {
        return null;
    }

    return (
        <ToolTip id={id} tip={description.toString()} />
    );
}

export { ArrayFieldTitleTemplate, ArrayFieldDescriptionTemplate };
