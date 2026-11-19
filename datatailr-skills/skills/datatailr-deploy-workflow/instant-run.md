# Using an Existing Image to Run a Workflow

It is possible to trigger a workflow run without waiting for an image to be built.
This is useful mostly for 'one-off' runs when the only thing the user wants is to run a calculation and get the results.
In addition, instant runs can be triggered from within a Jupyter notebook or a single Python script, without having to define the functions in a dedicated module.

## Jupyter Notebook Example

```python
from datatailr import workflow, task
import time

@task()
def map_data(data: float) -> float:
    return data ** 2

@task()
def reduce_data(*data_points: float) -> float:
    return sum(data_points)

@workflow()
def sum_of_squares(N=10):
    data = [map_data(x) for x in range(N)]
    return reduce_data(*data)

result = sum_of_squares(instant_run=True)
status = 'running'
while status != 'completed':
    print('Calculating', end='\r')
    time.sleep(2)
    status = result.status()

reduce_result = result.result('reduce_data')
map_result_of_four = result.result('map_data-4')
print('\nReady!\n')
print(f'Reduce result: {reduce_result}')
print(f'Map result of 4: {map_result_of_four}')
```
This will dispatch the workflow to run on the platform, using the existing image which is used for the user's default workstation.

The `result` object also serves as a Jupyter widget to display real-time status, logs, and results for the workflow run.
