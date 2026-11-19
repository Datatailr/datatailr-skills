# Voila
A Voila app is a Jupyter notebook served as an interactive web app. The deploy script pattern is similar to other frameworks, but the `entrypoint` is the path to the notebook file (e.g. `notebooks/my_notebook.ipynb`) instead of a Python module.

## App code
No special code structure is required for Jupyter notebooks. The platform serves them as a Voila app.

## Deploy script

```python
# deploy.py
from datatailr import App
from pathlib import Path

path_to_notebook = Path(__file__).parent / 'notebooks/my_notebook.ipynb'

app = App(
    name="My Jupyter Notebook",
    entrypoint=str(path_to_notebook),
    framework="voila",
    python_requirements=["voila", "jupyter", "ipywidgets"],
)
app.run()
```

## Requirements
Always include `"voila"`, `"jupyter"`, and `"ipywidgets"` in `python_requirements`. Add any additional dependencies needed to run the notebook based on the packages used in the notebook.
