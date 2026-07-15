# ODT Cloud: Admin Guide

## Updating ODT Cloud Dependencies

ODT Cloud intentionally does **not** update its dependencies automatically. Dependency version bumps should be performed manually, reviewed carefully, and validated before being merged. This reduces the risk of introducing unexpected or breaking changes.

It is recommended to update one dependency ecosystem at a time (e.g. npm, Python, Docker, etc.) to simplify testing and troubleshooting.

### Dependency locations

| Dependency type                  | Dependency declaration in                                                                                               | How to update dependencies                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend (npm)                   | [`package.json`](/package.json), [`package-lock.json`](/package-lock.json)                                              | see [npm audit](https://docs.npmjs.com/cli/v12/commands/npm-audit), [npm update](https://docs.npmjs.com/cli/v12/commands/npm-update) |
| Backend (Python)                 | [`backend/pyproject.toml`](/backend/pyproject.toml)                                                                     | change version tags and reinstall                                                                                                    |
| Backend (conda)                  | [`backend/environment.yml`](/backend/environment.yml)                                                                   | change version tags and reinstall                                                                                                    |
| Backend (conda, worker-specific) | [`backend/worker.environment.yml`](/backend/worker.environment.yml)                                                     | change version tags and reinstall                                                                                                    |
| External Docker images           | [`compose.yml`](/compose.yml), [`compose.prod.yml`](/compose.prod.yml), [`compose.override.yml`](/compose.override.yml) | change version tags and restart                                                                                                      |
| Docker base images               | [`docker/*.Dockerfile`](/docker/)                                                                                       | change version tags and rebuild                                                                                                      |
| Ansible (Python)                 | [`ansible/requirements.in`](/ansible/requirements.in)                                                                   | change version tags and reinstall                                                                                                    |
| Ansible (Ansible Galaxy)         | [`ansible/requirements.yml`](/ansible/requirements.yml)                                                                 | change version tags and reinstall                                                                                                    |
| GitHub Actions                   | [`.github/workflows/*.yml`](/.github/workflows/)                                                                        | change version tags                                                                                                                  |

### Bumping dependencies

Refer to the respective documentation for each dependency type on how to bump dependency versions.

For npm dependencies, it is recommended to regularly run `npm audit fix`.

## Release Management and Deployment

Each release corresponds to a git tag (see [all tags](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/tags)).
However, releasing a new version is not as simple as pushing a new tag. This section explains the steps necessary to release a new version of ODT Cloud and deploy it in production.

### Publishing a Release

To release a new version, first bump the version in [`package.json`](/package.json) using [npm version](https://docs.npmjs.com/cli/v12/commands/npm-version).
Then publish a new ODT Cloud Docker image:

1. Ensure that all required build variables used in [`.github/workflows/publish_images.yml`](/.github/workflows/publish_images.yml) are properly configured in GitHub's repository [variables](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/settings/variables/actions) and [secrets](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/settings/secrets/actions).
2. Create and push a git tag on the `main` branch via the GitHub UI using the format:

```
v<VERSION>
```

where `<VERSION>` is the semantic version being released, for example:

- `v0.2.0`
- `v0.2.0-alpha.4`

The GitHub Actions workflow will automatically build and publish the Docker image for the new tag.

### Deploying ODT Cloud

Deployments are performed using the project's GitHub Actions workflow.

Before starting a deployment:

1. Verify that the Docker image for the desired version has already been published.
2. Ensure all required environment variables are set in [`.github/workflows/deploy_stack.yml`](/.github/workflows/deploy_stack.yml).
3. Ensure all referenced GitHub repository [variables](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/settings/variables/actions) and [secrets](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/settings/secrets/actions) exist and are up to date.
4. Set the GitHub repository variable `ODT_CLOUD_VERSION` to the Docker image tag that should be deployed (for example, `0.2.0-alpha.4`). This tag **must** have been published as a Docker image before.
5. Manually trigger the **Deploy latest ODT Cloud stack** workflow from the GitHub Actions page.

If you need to deploy a new version manually, see [`ansible/README.md`](/ansible/README.md).

## Admin Panel

The Admin Panel is available to users with the **admin** role. After signing in, it can be accessed from the blue navigation menu on the left.

It consists of the following sections.

### Dashboard

The Dashboard provides key statistics on the total amount of users and pipeline runs.

![Admin Dashboard](/dev-docs/assets/images/admin_dashboard.png)

### User Management

The User Management page lists all registered users.

Administrators can:

- edit user information
- delete users
- ban users
- grant or revoke administrator privileges

Deleting a user permanently removes all stored information associated with that account, including pipeline runs. The user may subsequently create a new account using the same Helmholtz OAuth identity.

To permanently prevent account creation using a specific Helmholtz OAuth account, ban the user instead of deleting them.

![Admin User Management](/dev-docs/assets/images/admin_user_management.png)

### Pipeline Management

The Pipeline Management page lists all scheduled and completed pipeline runs.

Administrators can:

- inspect individual runs
- delete pipeline runs and their associated data
- manually update the status of a pipeline run

Deleting a pipeline run that is currently **Scheduled** or **Running** will cancel its execution.

![Admin Pipeline Management](/dev-docs/assets/images/admin_pipeline_management.png)

### Feedback

The Feedback page displays all feedback submitted via ODT Cloud's feedback button.

For each submission, ODT Cloud records metadata including:

- the page from which the feedback was submitted
- the associated pipeline run (if applicable)

This information can help reproduce and investigate reported issues.

### Monthly Reports

Monthly Reports provides downloadable CSV reports containing usage statistics. Reports are generated automatically on the first day of each month. Administrators can also manually trigger generation of past reports using the **Generate Reports** action.

An interactive chart at the top of the page visualizes usage trends over time using the reported data.

![Admin Monthly Reports](/dev-docs/assets/images/admin_monthly_reports.png)

### Legal Documents

The Legal Documents page is used to manage the:

- Terms of Service
- Data Protection Declaration

Documents are edited using Markdown.

Whenever a document is modified, previous versions are retained by ODT Cloud. This allows administrators to review historical versions or create new revisions based on earlier content when required.

![Admin Legal Documents](/dev-docs/assets/images/admin_legal_documents.png)

## User Management from the Command Line

### Accessing the Flask CLI

When running ODT Cloud in containers, the Flask CLI can only be accessed within the odt-server container.

If you are running the Flask server outside a Docker container, simply run:

```bash
flask --help
```

If you are running the flask server with docker compose, run:

```bash
docker compose exec odt-server bash
flask --help
# or in a single command:
docker compose exec odt-server micromamba run flask --help
```

For production use, our use of Docker Swarm across multiple VMs complicates the access slightly.
First ssh into the VM hosting odt-server, then identify the container and enter its shell:

```bash
# connect to VM hosting odt-server (double-check your ssh key location)
ssh -i ~/.ssh/odt-ansible-key -J ubuntu@134.94.199.236 ubuntu@odt-node-0
# identify odt-server container and enter its shell
ID=$(docker ps | grep odt-cloud_odt-server | head -n1 | cut -d ' ' -f1) && docker exec -it $ID bash
# run Flask CLI
flask --help
```

### Creating Users

When a user signs in using Helmholtz OAuth for the first time, ODT Cloud automatically creates a corresponding user account.

ODT Cloud also includes a legacy username/password authentication system. While this mechanism is expected to be deprecated after the OAuth migration is complete, new users can currently still be created using this command:

```bash
flask user register
```

Follow the interactive prompts to create the account.

### Granting Administrator Privileges

Existing users can be promoted to administrator through the **User Management** page in the Admin Panel.

Alternatively, administrator privileges can be granted from the command line:

```bash
flask admin promote "<username-or-helmholtz_sub>"
```

The placeholder `<username-or-helmholtz_sub>` refers either to:

- the legacy system username, or
- the user's Helmholtz OAuth `sub` identifier.

> [!IMPORTANT]
> This command must be used to create the **first administrator**, since no user has access to the Admin Panel until at least one administrator exists.
