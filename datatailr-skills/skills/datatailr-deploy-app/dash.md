# Dash

## App code

Create a module-level `app = Dash(...)` instance. Define layout and callbacks as usual. Expose `server = app.server` at the bottom for the production WSGI server (gunicorn).

Handle the URL prefix via the `DASH_REQUESTS_PATHNAME_PREFIX` environment variable -- the platform sets this automatically.

```python
# my_app/app.py
import os
from dash import Dash, Input, Output, callback, dcc, html

requests_pathname = os.environ.get("DASH_REQUESTS_PATHNAME_PREFIX", "/")

app = Dash(
    __name__,
    suppress_callback_exceptions=True,
    requests_pathname_prefix=requests_pathname,
)

app.layout = html.Div([
    html.H1("My Dash App"),
    dcc.Graph(id="example-graph"),
])

server = app.server

if __name__ == "__main__":
    app.run(debug=True)
```

## Deploy script

```python
# deploy.py
import my_app.app as entrypoint
from datatailr import App, Resources

app = App(
    name="My Dash App",
    entrypoint=entrypoint,
    framework="dash",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["dash", "gunicorn"],
)
app.run()
```

## Requirements

Always include `"dash"` and `"gunicorn"`. Dash apps are served via gunicorn in production. Add plotting/data libraries as needed (e.g., `"plotly"`, `"numpy"`, `"pandas"`).

## Local testing

```bash
python my_app/app.py
```
