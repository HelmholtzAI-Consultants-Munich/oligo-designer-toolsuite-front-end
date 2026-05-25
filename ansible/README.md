# Deploy ODT Cloud with Ansible

This directory contains the Ansible code used for deploying ODT Cloud on an OpenStack cluster.

## Using Ansible

### Setup

Make sure you are in the `ansible` directory. Activate a venv or conda environment and install the dependencies:

```bash
pip install -r requirements.in
```

Then also install the required Ansible collections:

```bash
ansible-galaxy collection install -r requirements.yml
```

### Provisioning

Make sure you have the `clouds.yaml` containing your OpenStack credentials at an appropriate location (e.g. `~/.config/openstack/clouds.yaml`). More information can be found in the [openstacksdk docs](https://docs.openstack.org/openstacksdk/2026.1/user/guides/connect_from_config.html).

To provision the servers, run:

```bash
ansible-playbook playbook.yml
```
