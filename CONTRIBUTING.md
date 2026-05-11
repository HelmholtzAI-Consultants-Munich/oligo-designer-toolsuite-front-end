# Contributing to Oligo Designer Toolsuite Cloud

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how we handle them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions. 🎉

> If you like the project, but just don't have time to contribute, that's fine. There are other easy ways to support the project and show your appreciation, which we would also be very happy about:
>
> - Star the project
> - Refer this project in your project's readme
> - Mention the project and the [Oligo Designer Toolsuite Project](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite)

## Table of contents

- [Short Links](#short-links)
- [I have a question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
  - [Adding issues](#adding-issues)
  - [Development Process](#development-process)
  - [Code Contributions](#code-contributions)
  - [Documentation contributions](#documentation-contributions)
  - [Reporting bugs](#reporting-bugs)
  - [Suggesting enhancements](#suggesting-enhancements)

## Short links

- [Documentation](https://helmholtzai-consultants-munich.github.io/oligo-designer-toolsuite-front-end/)
- [Bugs/ Enhancements](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/issues)

## I Have a Question

> If you want to ask a question, we assume that you have read the available [Documentation](https://helmholtzai-consultants-munich.github.io/oligo-designer-toolsuite-front-end/).

Before you ask a question, it is best to search for existing [Issues](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question as a comment on this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [Issue](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, docker, conda, python, pip), depending on what seems relevant.

We will then take care of the issue.

## I Want To Contribute

> ### Legal Notice
>
> When contributing to this project, you must agree that you have authored 100% of the content or reviewed it thoroughly, so that you have the necessary rights to the content and that the content you contribute may be provided under the project license.

### Adding Issues

> NOTE: if in doubt open the issue in this Repo and we will investigate the source

Before adding any type of issue check if the issue is related to this project. Because this project serves as a webserver for [Oligo Designer Toolsuite Project](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite), the source of issues that are related to running a pipeline could also be in the Oligo Designer Toolsuite. Therefore verify that using your configs and input files produces a valid pipeline run when directly using Oligo Designer Toolsuite.

### Reporting Bugs

Before creating a bug report check search the issue tracker to validate that the problems has not been reported so far. Also check if your Version of ODT Cloud is up-to-date before reporting a bug.

Bug reports should include:

- Version ODT Cloud you are using
- OS information (Which Linux?, Arm / x86)
- docker version
- docker logs input/ output
- is it possible to reproduce the issue?
- possibly screenshots/ screen recordings of observed behavior

We use GitHub issues to track bugs and errors. If you verified your bug is not a duplicate and you collected all necessary information you can open a bug report.

#### How to make a good bug report?

- Open an Issue. (Since we can’t be sure at this point whether it is a bug or not, we ask you not to talk about a bug yet and not to label the issue.)
- Explain the behavior you would expect and the actual behavior.
- Please provide as much context as possible and describe the reproduction steps that someone else can follow to recreate the issue on their own. If possible, isolate the problem and create a reduced test case.
- Provide the information you collected in the previous section.

### Suggesting Enhancements

Any ideas on enhancing ODT Cloud are welcome, whether you have one for a minor quality-of-life improvement or a completely new feature, we are happy to read about it. Before suggesting an enhancement follow this list:

- Make sure you are using the latest version of ODT Cloud
- read the documentation and check that your idea is not already mentioned
- read through the issues and check that your enhancement has not been suggested already
- Think about if your idea belongs here, as it should add value for most users

If you could tick every box, then you can submit your enhancement to our Github Issues.

#### How to write a good enhancement suggestion?

- Use a summarizing, clear and descriptive title
- Include a clear and descriptive description of your idea
- Describe current behavior and compare it to the behavior you want to see
- You could include screenshots/ screen recordings of the current behavior and mockups using e.g. Figma to show what you wish the enhancement should look like
- Explain which benefit your enhancement will provide to the project
- Also showing examples of other projects which include a similar feature could be helpful

### Development Process

Before working on any issue, the bug/enhancement should be converted into a user story or a simple issue by the maintainers.

#### Adding User Stories

User stories are significant tasks, which are labeled with `user story`. description should include a summary and a list of acceptance criteria. Further the project fields should be populated.

#### Adding Simple Issues

These issues are easy tasks, e.g. easily fixable bugs, small changes or quick tasks that don't deserve being treated like a full user story. The description should be enough to understand and resolve the issue. Further the Project fields can be left empty. While they are small and easy, simple issues should still be solved on a separate branch, to avoid time intensive reviews and merge conflicts.

#### Branches

Every issue should be solved on a separate branch, therefore you must first create one for your issue. Branches must follow the naming convention: `<type>-#<issue_number>-NAME1-NAME2`, where

- `<type> = feat | fix | build | chore | ci | docs | style | refactor | perf | test`
- `<issue_number> refers to the issue in the issue tracker`

Old branches that are merged into main are removed regularly by the maintainers of this project.

#### Commits

Commits should adhere to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). So the format is: `<type>-<message>`, where

- `<type>` see [above](#branches)
- `<message>` globally descriptive message

#### Pull Requests

Before submitting a Pull Request ensure that you followed our [Style guide](docs/styleguide.md), ran the [pre-commit](docs/ide-setup.md#installing-pre-commit) hooks and [tests](docs/tests.md).

A Pull Request should include a short summary at the top and a bullet list of key changes. Furthermore it should include a `resolves <issue-number>` to link the respective User Story. Also all merge conflicts should be solved when submitting a PR. After submitting a PR it gets reviewed by at least one person. After the PR is reviewed and the tests are passing, the PR gets merged by the author. There could be changes in the merge order which are communicated in advance. Use Merge Commit as the merging strategy.

##### Reviews

Pull Request review should ensure that the described functionality in the PR is working properly and the code quality is matching the standards.

Reviewers **SHOULD**:

- verify that the issue is solved
- check the PR adheres to the style guide
- validate the scope od the user story was respected

Reviewers **SHOULD NOT**:

<!-- TODO: reactivate after finishing last sprints -->

- ~~make direct edits on the PR branch~~(currently not enforced to speed up development)

### Code Contributions

Before starting to work on code, please read the [Development Process](#development-process)

#### Setup

Before starting to contribute code read and follow the [README](README.md), [Getting Started Documentation](docs/getting-started.md) and [setup your IDE](docs/ide-setup.md).

#### Style guide

The formatting rules are enforced by our [pre-commit](docs/ide-setup.md#installing-pre-commit), so please set it up properly. Further refer to the [style guide](docs/styleguide.md) to get information about other conventions we use.

#### Testing

The code should pass all tests, while they are run via github actions, you can also run them locally ([see](docs/tests.md)). Also new functionality must include unit-tests verifying correct behavior.

#### Security

When fixing a security issue or otherwise adding a security check, you must document it in the code. This allows future developers to see that these changes were done to prevent security breaches.

#### Documentation

Code should be commented, especially if it is not self-explanatory. Therefore refer to our [style guide](docs/styleguide.md) to see how comments in the code should be structured.

### Improving the documentation

> **NOTE:** this section is about user-facing documentation and basic development documentation such as setup/ how to run tests. When you want to document code or certain behavior that is mostly interesting to developers, please refer to the [Code Documentation section](#documentation).

The documentation is written in the `docs` folder and is user-facing, if you want to add documentation that is relevant to developers refer to the [style guide](docs/styleguide.md) to see our code comment style.
The documentation is written in markdown style and we use [jekyll-build-pages](https://github.com/actions/jekyll-build-pages) with the [Just the docs](https://github.com/just-the-docs/just-the-docs) to build the documentation for deployment on github pages.

<!--
This Contributing.md is based on
https://mozillascience.github.io/working-open-workshop/contributing/
https://contributing.md/
-->
