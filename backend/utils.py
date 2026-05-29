from typing import Any


def retrieve_form_data_value(path: str | list[str], form_data: dict[str, Any]) -> Any:
    """
    This methods uses a key or a list of keys to retrieve
    a value from the form_data.

    Arguments:
        path {str | list[str]} -- list of keys that can be iterated to retrieve a value
        form_data {dict[str, Any]} -- form data that contains nested dictionaries

    Returns:
        Any -- form data value or None
    """

    for part in path:
        if part not in form_data:
            return None
        form_data = form_data[part]
    return form_data


def serialize_form_data_path(path: str | list[str]):
    return ".".join(path)


def deserialize_form_data_path(path_str: str):
    path = path_str.split(".")
    return path if len(path) > 1 else path_str
