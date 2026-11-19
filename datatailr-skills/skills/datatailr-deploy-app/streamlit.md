# Streamlit

## App code

Write a standard Streamlit app with a `main()` function. No Datatailr-specific code needed.

```python
# my_app/app.py
import streamlit as st

def main():
    st.title("My App")
    st.write("Hello from Datatailr!")

if __name__ == "__main__":
    main()
```

Multi-page apps: use the `pages/` subdirectory convention inside the app module.

## Deploy script

Import the **module**:

```python
# deploy.py
import my_app.app as entrypoint
from datatailr import App, Resources

app = App(
    name="My Streamlit App",
    entrypoint=entrypoint,
    framework="streamlit",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["streamlit"],
)
app.run()
```

## Requirements

Always include `"streamlit"`. Add any other imports your app uses (e.g., `"pandas"`, `"requests"`, `"plotly"`).

## Local testing

Run from the project root:

```bash
streamlit run my_app/app.py
```

If the app uses absolute imports (`from my_app.utils import ...`) and they fail locally, use `PYTHONPATH=. streamlit run my_app/app.py`. This is a local-only issue; Datatailr sets up the import path correctly.
