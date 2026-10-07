# FastAPI

## App code

Create a module-level `app = FastAPI(...)` instance with standard routing. The platform serves FastAPI apps via uvicorn.

```python
# my_app/app.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def index():
    return {"message": "Hello from Datatailr!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

For apps with templates, use Jinja2Templates with `importlib.resources` to resolve paths:

```python
from importlib.resources import files
from pathlib import Path
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

_PKG = files(__package__)
app.mount("/static", StaticFiles(directory=str(Path(str(_PKG.joinpath("static"))))), name="static")
templates = Jinja2Templates(directory=str(Path(str(_PKG.joinpath("templates")))))
```

## Deploy script

```python
# deploy.py
import my_app.app as entrypoint
from datatailr import App, Resources

app = App(
    name="My FastAPI App",
    entrypoint=entrypoint,
    framework="fastapi",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["fastapi", "uvicorn"],
)
app.run()
```

## Requirements

Always include `"fastapi"` and `"uvicorn"`. Add `"jinja2"` and `"python-multipart"` if using templates or form data.

## Local testing

```bash
uvicorn my_app.app:app --reload
```
