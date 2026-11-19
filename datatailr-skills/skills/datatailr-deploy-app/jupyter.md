# Jupyter

## App code
No special code structure is required for Jupyter notebooks. The platform serves them as a jupyter notebook.

## Deploy script

```python
# deploy.py
from datatailr import App
from pathlib import Path

path_to_notebook = Path(__file__).parent / 'notebooks/my_notebook.ipynb'

app = App(
    name="My Jupyter Notebook",
    entrypoint=str(path_to_notebook),
    framework="jupyter",
    python_requirements=["jupyter"],
)
app.run()
```

## Requirements
Always include `"jupyter"` in `python_requirements`. Add any additional dependencies needed to run the notebook based on the packages used in the notebook.
