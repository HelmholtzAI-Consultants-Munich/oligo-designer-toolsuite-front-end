# Deploy ODT Cloud with Ansible

This directory contains the Ansible code used for deploying ODT Cloud on an OpenStack cluster.

## System Access

### OpenStack Credentials

Ansible first connects to the OpenStack server using credentials that must be provided via environment variables, typically by sourcing an OpenStack RC file.

To use user-independent application credentials, the RC file may look like this:

```bash
export OS_AUTH_TYPE=v3applicationcredential
export OS_AUTH_URL=https://cloud.jsc.fz-juelich.de:5000
export OS_APPLICATION_CREDENTIAL_ID=<YOUR_CREDENTIAL_ID>
export OS_APPLICATION_CREDENTIAL_SECRET=<YOUR_CREDENTIAL_SECRET>
```

Given that you named your file `openrc.sh`, you can then source it like this:

```bash
. openrc.sh
```

### SSH Key Pair

After provisioning the VMs, Ansible connects to them using ssh. Since only a single VM is publicly accessible, we use it as a 'jump host' (also known as 'bastion host'). Make sure you have the private key of the `odt-ansible-key` key pair in your ssh directory (i.e. `~/.ssh/odt-ansible-key`). The public IP of this jump host is currently hard-coded to `134.94.199.236`.

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

### Executing the Playbook

Before deploying ODT Cloud, prepare your production environment file at `ansible/files/.env`.

To provision and configure the servers, run:

```bash
ansible-playbook playbook.yml
```

## Infrastructure

### VM Host

Our VMs get deployed on [JSC Cloud](https://apps.fz-juelich.de/jsc/hps/jsccloud/index.html) provided by Forschungszentrum Jülich GmbH. It uses OpenStack for orchestration.

### VM Instances

We currently provision two VMs:

|              |      odt-main      |   odt-node-0    |
| :----------: | :----------------: | :-------------: |
|    flavor    |    SCS-2L:2:20n    | SCS-16L:64:20n  |
|    VCPUs     |         2          |       16        |
|     RAM      |         2G         |       64G       |
|  node type   |      Manager       |     Worker      |
| ODT services | web server & proxy | everything else |

The reasoning for choosing the weakest node as the Docker Swarm Manager is as follows:  
odt-main only serves our frontend as a static bundle. Thus, we expect very little stress put upon the VM.
In contrast, odt-node-0 is tasked with the heavy lifting - providing the backend API and executing ODT pipelines among other things. It is thus more likely to suffer from unexpected outages or unscheduled maintenance. Overall, odt-main is more reliable as a management (and monitoring) node.

## References

- info on dynamic OpenStack inventory loading at [openstack_inventory docs](https://docs.ansible.com/projects/ansible/latest/collections/openstack/cloud/openstack_inventory.html#ansible-collections-openstack-cloud-openstack-inventory)
- Swarm deployment adapted from [this blog post](https://oneuptime.com/blog/post/2026-02-21-ansible-manage-docker-swarm/view)
- Traefik configuration adapted from [Traefik docs](https://doc.traefik.io/traefik/setup/swarm/)
