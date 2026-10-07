# Flask

## App code

Create a module-level `app = Flask(...)` instance with standard routing. The platform serves Flask apps via gunicorn.

```python
# my_app/app.py
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({"message": "Hello from Datatailr!"})

if __name__ == "__main__":
    app.run(debug=True)
```

For apps with templates and static files, use `importlib.resources` to resolve paths relative to the package:

```python
from importlib.resources import files
from pathlib import Path

_PKG = files(__package__)
_STATIC_DIR = str(Path(str(_PKG.joinpath("static"))))
_TEMPLATES_DIR = str(Path(str(_PKG.joinpath("templates"))))

app = Flask(__name__, template_folder=_TEMPLATES_DIR, static_folder=_STATIC_DIR)
```

## Deploy script

```python
# deploy.py
import my_app.app as entrypoint
from datatailr import App, Resources

app = App(
    name="My Flask App",
    entrypoint=entrypoint,
    framework="flask",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["flask", "gunicorn"],
)
app.run()
```

## Requirements

Always include `"flask"` and `"gunicorn"`. Flask apps are served via gunicorn in production.

## Local testing

```bash
python my_app/app.py
```
