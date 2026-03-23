---
title: OpenStack Deployment
layout: default
nav_order: 3
parent: Development
---

# OpenStack Deployment

ODT Cloud can be deployed on JSC OpenStack using the Heat template at `heat_full.yaml`.

---

## Prerequisites

- OpenStack CLI installed (`pip install python-openstackclient python-heatclient`)
- A valid `clouds.yaml` or sourced `openrc` file
- An existing SSH keypair (`openstack keypair list`)

## Parameters

| Parameter                      | Required | Default                  | Description                                    |
| :----------------------------- | :------: | :----------------------- | :--------------------------------------------- |
| `key_name`                     |   yes    | —                        | Name of your OpenStack SSH keypair             |
| `ssh_cidr`                     |   yes    | —                        | Source CIDR allowed to SSH (e.g. `1.2.3.4/32`) |
| `image`                        |    no    | `Ubuntu Jammy 22.04 LTS` | Glance image name                              |
| `flavor`                       |    no    | `SCS-16L:64:20n`         | Nova flavor                                    |
| `existing_floating_ip_id`      |   yes    | —                        | Floating IP UUID created outside the stack     |
| `existing_floating_ip_address` |   yes    | —                        | Floating IP address (e.g. `134.94.199.236`)    |
| `volume_size`                  |    no    | `200`                    | Data volume size in GB                         |

## Create the stack

Create/allocate a floating IP in OpenStack first, then note:

- floating IP `ID` (`openstack floating ip list` can help)
- floating IP `address`

Optionally, find your public IP first (to narrow `ssh_cidr`):

```bash
curl -s ifconfig.me
```

Then create the stack:

```bash
openstack stack create -t heat_full.yaml odt-stack \
  --parameter key_name="yarkin-key" \
  --parameter ssh_cidr="0.0.0.0/0" \
  --parameter existing_floating_ip_id="YOUR_FLOATING_IP_ID" \
  --parameter existing_floating_ip_address="134.94.199.236"
```

Override any defaults as needed:

```bash
openstack stack create -t heat_full.yaml odt-stack \
  --parameter key_name=mykey \
  --parameter ssh_cidr=203.0.113.5/32 \
  --parameter existing_floating_ip_id="YOUR_FLOATING_IP_ID" \
  --parameter existing_floating_ip_address="134.94.199.236" \
  --parameter volume_size=100
```

## Check status and outputs

```bash
openstack stack show odt-stack -f yaml
openstack stack output show odt-stack floating_ip
openstack stack output show odt-stack ssh_command
```

## Delete the stack

```bash
openstack stack delete odt-stack
```

The data volume is **retained** on deletion to prevent accidental data loss. To reuse it, import it into a new stack or attach it manually.
