"""Utility functions for the worker should be defined here."""

from pydantic import BaseModel


def build_fallback_error_message(runner_type: str):
    """Builds the generic error message shown to the user when a runner fails.

    Arguments:
        runner_type {str} -- the kind of runner that failed, as named in the message

    Returns:
        str -- the user-facing error message
    """
    return f"The {runner_type} failed to execute. Please check your input and try again. If the error persists, please inform us of the issue."


def strip_local_descriptions(schema: dict, namespace: dict, module_name: str) -> dict:
    """Removes the schema descriptions that Pydantic takes from the caller module's own class docstrings.

    Arguments:
        schema {dict} -- the generated JSON Schema, modified in place
        namespace {dict} -- the caller's `globals()`, holding both its own models and any it imported
        module_name {str} -- the caller's `__name__`, to tell its own models from imported ones

    Notes:
        Those docstrings explain why an ODT model is overridden, which is a note for developers, but
        the front-end shows a model's description as a section subtitle or a tooltip. ODT's own
        descriptions are written for users and are kept.

    Returns:
        dict -- the same schema without the caller module's docstrings
    """
    local = {
        value.__name__
        for value in namespace.values()
        # the module has to be checked: an ODT model imported into the namespace is in there too,
        # and dropping its description would take a user-facing one with it
        if isinstance(value, type) and issubclass(value, BaseModel) and value.__module__ == module_name
    }
    for name in schema.get("$defs", {}).keys() & local:
        schema["$defs"][name].pop("description", None)
    schema.pop("description", None)
    return schema


def accept_uploaded_files(schema: dict, *fields: str) -> dict:
    """Lets file path fields also accept an object, so the front-end's `File` passes validation.

    Arguments:
        schema {dict} -- the generated JSON Schema, modified in place
        *fields {str} -- the names of the properties to widen, at any depth

    Notes:
        A file input keeps the picked `File` in the form data until submission, when it is replaced
        by the name the backend saved it under. The model types these fields as the saved path,
        which a `File` is not, so the schema the form validates against must accept an object too.

    Returns:
        dict -- the same schema, with those properties accepting an object too
    """

    def as_path_or_file(schema: dict) -> dict:
        return {
            "anyOf": [{"type": "string"}, {"type": "object"}],
            **{k: v for k, v in schema.items() if k != "type"},
        }

    def widen(node: object) -> None:
        if isinstance(node, list):
            for item in node:
                widen(item)
            return
        if not isinstance(node, dict):
            return
        for field in fields:
            prop = node.get("properties", {}).get(field)
            if not isinstance(prop, dict):
                continue
            if prop.get("type") == "string":
                node["properties"][field] = as_path_or_file(prop)
            # a field taking several files holds the paths in a list
            elif prop.get("type") == "array" and prop.get("items", {}).get("type") == "string":
                prop["items"] = as_path_or_file(prop["items"])
        for value in node.values():
            widen(value)

    widen(schema)
    return schema
