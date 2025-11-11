export const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setFormData: any
) => {
    const { name, value } = e.target;
    const keys = name.split(".");

    if (keys.length === 2) {
        const [parent, child] = keys;
        setFormData((prev: any) => ({
            ...prev,
            [parent]: {
                ...(prev as any)[parent],
                [child]: {
                    ...(prev as any)[parent]?.[child],
                    value,
                },
            },
        }));
    } else {
        setFormData((prev: any) => ({
            ...prev,
            [name]: {
                ...(prev as any)[name],
                value,
            },
        }));
    }
};