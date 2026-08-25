"""Utility functions for the worker should be defined here."""

from pydantic import BaseModel


def build_fallback_error_message(runner_type: str):
    return f"The {runner_type} failed to execute. Please check your input and try again. If the error persists, please inform us of the issue."


def mark_schema_flags(schema: dict, flags: dict[str, dict[str, tuple[str, ...]]]) -> dict:
    """Sets the front-end's `x-` flags on the fields listed for them.

    The flags only tell the front-end how to render a field, so they are stamped onto the
    generated schema rather than declared on the models. Most of the fields they mark are ODT's,
    and Pydantic cannot annotate an inherited field without redeclaring it, which would drop the
    default, description and constraints ODT set on it.

    Arguments:
        schema {dict} -- the generated JSON Schema, modified in place
        flags {dict[str, dict[str, tuple[str, ...]]]} -- field names per model per flag

    Returns:
        {dict} -- the same schema, with the flags set

    Raises:
        KeyError: if a model or field is named that the schema does not define
    """
    for flag, models in flags.items():
        for model, fields in models.items():
            properties = schema["$defs"][model]["properties"]
            for field in fields:
                properties[field][flag] = True
    return schema


def hide_fields(schema: dict, *fields: str) -> dict:
    """Removes top-level fields from a generated schema so the front-end never renders them.

    The backend fills them back in before validating a submission, see `add_non_exposed_fields`.
    Only oligoseq's ODT model has a base class that leaves them out already; for the other
    pipelines the field has to be dropped from the schema instead.

    Arguments:
        schema {dict} -- the generated JSON Schema, modified in place
        *fields {str} -- names of the top-level properties to drop

    Returns:
        {dict} -- the same schema without those properties
    """
    for field in fields:
        schema["properties"].pop(field, None)
        if field in schema.get("required", []):
            schema["required"].remove(field)
    return schema


def strip_local_descriptions(schema: dict, namespace: dict, module_name: str) -> dict:
    """Drops the descriptions Pydantic derives from the caller module's own class docstrings.

    Those docstrings say why an ODT model is overridden, which is a note for developers, but the
    front-end renders a model's description as a section subtitle or a tooltip. ODT's own
    descriptions are written for users and are left alone.

    Arguments:
        schema {dict} -- the generated JSON Schema, modified in place
        namespace {dict} -- the caller's `globals()`, holding both its own models and any it imported
        module_name {str} -- the caller's `__name__`, so an imported model can be told from its own

    Returns:
        {dict} -- the same schema without the caller module's docstrings
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
    """Widens fields naming a file so the front-end's `File` object validates against them.

    A file input holds the picked `File` in the form data until submission, where it is swapped
    for the name the backend saved it under. The model types these fields as the path they end
    up being, which a `File` is not, so the schema the form validates against has to accept an
    object as well.

    Arguments:
        schema {dict} -- the generated JSON Schema, modified in place
        *fields {str} -- names of the properties to widen, at any depth

    Returns:
        {dict} -- the same schema, with those properties accepting an object too
    """

    def widen(node: object) -> None:
        if isinstance(node, list):
            for item in node:
                widen(item)
            return
        if not isinstance(node, dict):
            return
        for field in fields:
            prop = node.get("properties", {}).get(field)
            if isinstance(prop, dict) and prop.get("type") == "string":
                node["properties"][field] = {
                    "anyOf": [{"type": "string"}, {"type": "object"}],
                    **{k: v for k, v in prop.items() if k != "type"},
                }
        for value in node.values():
            widen(value)

    widen(schema)
    return schema
