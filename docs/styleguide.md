---
title: Style Guide
layout: default
nav_order: 8
parent: Development
---

<!-- TODO: Remove before deployment -->

> NOTE: this style guide is still evolving. Any ideas/ exceptions from the referenced style guides should be documented and added here.

# Style Guide

## Python Style Guide

### Formatting

We are using [ruff-format](https://docs.astral.sh/ruff/formatter) to format our python code, since it adheres to the [Black code style](https://black.readthedocs.io/en/stable/the_black_code_style/current_style.html) we also do.

### Other

When it comes to naming of variables, types, classes, etc. and the position of imports we adhere to the conventions of the [PEP 8 - Style Guide for Python Code](https://peps.python.org/pep-0008/#naming-conventions).

Rules:

#### File Names

File names should be in lowercase with underscores separating words, e.g. `file_name.py`.

### Documentation

Python should be commented in the [DocBlockr style](https://github.com/NilsJPWerner/autoDocstring/blob/master/docs/docblockr.md). We suggest using the recommended extensions where [autoDocstring](https://github.com/NilsJPWerner/autoDocstring) is included, which allows generating a template comment based on the function signature.

## Typescript Style Guide

### Formatting

We format our code using [prettier](https://prettier.io/docs/). See our [package.json](package.json) for our setting and refer to the prettier docs for getting information about the enforced style guide.

### File Names

Files providing an React Component or use jsx otherwise should be named like `PascalCase.tsx`. Whereas files that provide non-jsx using code, like utility functions, types etc., should be named `camelCase.ts`

### Other

We adhere to the [typescript style guide](https://ts.dev/style/) from TS.dev.

### Documentation

We use [TSDoc Comments](https://tsdoc.org/). The format is similar to JSDoc comments and we follow the exceptions mentioned in the [typescript style guide](https://ts.dev/style/). Using VSCode/VSCodium you can autogenerate [JSDoc](https://jsdoc.app/) comments typing `/**` above a function signature. **Note** that JSDOC differs slightly from TSDoc.
