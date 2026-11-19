# Panel

## App code

Panel apps are **declarative** -- no `main()` function needed. Build your components and call `.servable()` on the top-level layout at module level. The platform runs the app via `panel serve`.

```python
# my_app/app.py
import panel as pn

pn.extension(sizing_mode="stretch_width")

text = pn.pane.Markdown("# Hello from Datatailr!")
slider = pn.widgets.IntSlider(name="Value", start=0, end=100, value=50)

def update(value):
    return f"The value is **{value}**"

output = pn.bind(update, slider)

template = pn.template.FastListTemplate(
    title="My Panel App",
    main=[text, slider, output],
)
template.servable()
```

Key points:
- Call `pn.extension(...)` at the top to load needed JS extensions (e.g., `"perspective"`, `"echarts"`).
- Call `.servable()` on your template or top-level component. This is what the platform picks up.
- No `if __name__ == "__main__"` block is needed.

## Deploy script

Import the **package** (not `my_app.app`) — the runner finds `app.py` inside it:

```python
# deploy.py
import my_app as entrypoint
from datatailr import App, Resources

app = App(
    name="My Panel App",
    entrypoint=entrypoint,
    framework="panel",
    resources=Resources(memory="2g", cpu=1),
    python_requirements=["panel"],
)
app.run()
```

## Requirements

Always include `"panel"`. Add libraries for any extensions used (e.g., `"perspective"` for Perspective widgets).

## Local testing

```bash
panel serve my_app/app.py
```
