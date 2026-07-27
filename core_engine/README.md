# Core Engine

Google OR-Tools implementation of the Capacitated Vehicle Routing Problem used
by LogiRoute VN.

The engine accepts one depot, a fleet with weight capacities, and delivery
orders. It minimizes straight-line Haversine distance, allows infeasible orders
to remain unassigned, and returns typed Pydantic route output.

Install it from the monorepo root in editable mode:

```powershell
cd D:\Individual_Project\apps\api
.\.venv\Scripts\python.exe -m pip install -e ..\..
```

Run the standalone demo:

```powershell
cd D:\Individual_Project
apps\api\.venv\Scripts\python.exe core_engine\solver.py
```
