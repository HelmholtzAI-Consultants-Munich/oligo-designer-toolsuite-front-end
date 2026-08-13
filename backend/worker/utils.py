"""Utility functions for the worker should be defined here."""

import copy
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, create_model


def build_fallback_error_message(runner_type: str):
    return f"The {runner_type} failed to execute. Please check your input and try again. If the error persists, please inform us of the issue."


def _mark_fields(flag: str, field_names: tuple[str, ...]) -> Callable[[type[BaseModel]], type[BaseModel]]:
    """Builds a class decorator setting a front-end flag on the named fields of a model.

    Copies each `FieldInfo` instead of redeclaring the field, because redeclaring replaces it
    and would drop the description, default and constraints ODT set on it.

    Arguments:
        flag {str} -- the JSON Schema keyword to set, e.g. `x-collapsed`
        field_names {tuple[str, ...]} -- names of the fields to mark

    Returns:
        {Callable} -- decorator returning a subclass whose named fields carry the flag
    """

    def decorator(model: type[BaseModel]) -> type[BaseModel]:
        # `dict[str, Any]`, because `create_model` takes the field definitions as keyword
        # arguments beside its own `__dunder__` ones, and a narrower type cannot describe both
        overrides: dict[str, Any] = {}
        for name in field_names:
            field = copy.deepcopy(model.model_fields[name])
            extra = field.json_schema_extra if isinstance(field.json_schema_extra, dict) else {}
            field.json_schema_extra = {**extra, flag: True}
            overrides[name] = (field.annotation, field)
        # name, module and docstring are carried over, so the subclass is indistinguishable
        # from the model it decorates
        return create_model(
            model.__name__,
            __base__=model,
            __doc__=model.__doc__,
            __module__=model.__module__,
            **overrides,
        )

    return decorator


def with_quick_settings(*field_names: str) -> Callable[[type[BaseModel]], type[BaseModel]]:
    """Marks fields so the front-end pins them to the Quick Settings panel above the form's tabs,
    and renders them only there.

    Arguments:
        field_names {str} -- names of the fields to mark

    Returns:
        {Callable} -- decorator returning a subclass carrying `x-quick-setting`
    """
    return _mark_fields("x-quick-setting", field_names)


def with_collapsed(*field_names: str) -> Callable[[type[BaseModel]], type[BaseModel]]:
    """Marks fields so the front-end renders them collapsed behind a toggle, keeping a long list
    of expert parameters out of the way until it is asked for.

    Arguments:
        field_names {str} -- names of the fields to mark

    Returns:
        {Callable} -- decorator returning a subclass carrying `x-collapsed`
    """
    return _mark_fields("x-collapsed", field_names)
