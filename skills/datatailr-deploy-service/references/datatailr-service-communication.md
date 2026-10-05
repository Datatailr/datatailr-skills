# Calling Datatailr Services

Any Datatailr job (app, workflow, add-in, or another service) can call a deployed service over HTTP using its internal hostname. This page explains how the hostname is derived and how to make requests.

## Internal hostname

Every deployed service gets an internal hostname based on its **normalized name**:

1. Take the `name` parameter from the deploy script (e.g., `"Portfolio API"`).
2. Lowercase it, replace any non-alphanumeric characters with hyphens, strip leading/trailing hyphens.

| `name` parameter | Internal hostname |
|---|---|
| `"Portfolio API"` | `portfolio-api` |
| `"Simple Service - johndoe"` | `simple-service-johndoe` |
| `"My Data Service"` | `my-data-service` |

The service is reachable at `http://<hostname>` from any other job on the platform.

## Making requests from Python

Use `requests` (or any HTTP library) with the internal hostname:

```python
import requests

response = requests.get("http://portfolio-api/risk/summary", timeout=5)
data = response.json()
```

## Making requests from the CLI

```bash
curl http://portfolio-api/risk/summary
```

## Name your services predictably

Since other components must construct the URL, choose service names that produce clean hostnames. Avoid special characters or very long names. If multiple users deploy the same service, include the username in the name to avoid collisions:

```python
from datatailr import User

service = Service(
    name=f"Portfolio API - {User.signed_user()}",
    ...
)
```

The hostname becomes `portfolio-api-<username>`, and callers construct the URL accordingly.
