---
title: OpenStack Deployment
layout: default
nav_order: 3
parent: Development
---

# OpenStack Deployment

ODT Cloud can be deployed on JSC OpenStack using the Heat template at `deploy/stack.yaml`.

---

## Prerequisites

- OpenStack CLI installed (`pip install python-openstackclient python-heatclient`)
- A valid `clouds.yaml` or sourced `openrc` file
- An existing SSH keypair (`openstack keypair list`)

## Parameters

| Parameter          | Required | Default                  | Description                                    |
| :----------------- | :------: | :----------------------- | :--------------------------------------------- |
| `key_name`         |   yes    | —                        | Name of your OpenStack SSH keypair             |
| `ssh_cidr`         |   yes    | —                        | Source CIDR allowed to SSH (e.g. `1.2.3.4/32`) |
| `image`            |    no    | `Ubuntu Jammy 22.04 LTS` | Glance image name                              |
| `flavor`           |    no    | `SCS-16L:64:20n`         | Nova flavor                                    |
| `external_network` |    no    | `dmz-jsc-cloud`          | External network for floating IPs              |
| `volume_size`      |    no    | `200`                    | Data volume size in GB                         |

## Create the stack

Find your public IP first:

```bash
curl -s ifconfig.me
```

Then create the stack:

```bash
openstack stack create odt \
  -t deploy/stack.yaml \
  --parameter key_name=<your-keypair> \
  --parameter ssh_cidr=<your-ip>/32
```

Override any defaults as needed:

```bash
openstack stack create odt \
  -t deploy/stack.yaml \
  --parameter key_name=mykey \
  --parameter ssh_cidr=203.0.113.5/32 \
  --parameter volume_size=100
```

## Check status and outputs

```bash
openstack stack show odt -f yaml
openstack stack output show odt floating_ip
openstack stack output show odt ssh_command
```

## Delete the stack

```bash
openstack stack delete odt
```

The data volume is **retained** on deletion to prevent accidental data loss. To reuse it, import it into a new stack or attach it manually.
