---
title: Setting up your IDE
layout: default
nav_order: 1
parent: Development
---

# Setting up your IDE

This document describes the basic configuration required to set up your IDE. The documentation is currently limited to VS Code / VSCodium. Configure your environment according to the [Getting Started]({{ site.baseurl }}{% link getting-started.md %}) guide before following these instructions.

## VS Code / VSCodium Extensions and Settings

The repository includes a list of recommended extensions in `.vscode/extensions.json` as well as a `.vscode/settings.sample.json`.
Consider [creating a separate profile](https://code.visualstudio.com/docs/configure/profiles) for this project to prevent loading unrelated extensions.

> ##### TIP for VSCodium users
>
> Take a look at the included files and uncomment any lines marked as replacements for extensions and settings
> that are not available in VSCodium.
{: .block-tip }

Install the recommended extensions either via the automatic pop-up or by searching for `@recommended` in the "Extensions" tab. Rename `.vscode/settings.sample.json` to `.vscode/settings.json` to enable these settings for your workspace. You can change these settings to your liking - they are not tracked by git.

### Selecting your Python Environment

After setting up your Conda environment and installing the recommended extensions, open up any Python file and click on the Python version in the bottom right corner. You can then select your Conda environment as your Python interpreter.

## Installing pre-commit

[pre-commit](https://pre-commit.com) is a tool that runs a list of checks and automatic fixes prior to committing. These include basic linter and formatter rules as defined in `.pre-commit-config.yaml`.

While it's possible to run pre-commit manually using `pre-commit run -a`, we highly recommend installing the git pre-commit hook that will ensure pre-commit runs on all changed files before they are committed:

```bash
pre-commit install
```
