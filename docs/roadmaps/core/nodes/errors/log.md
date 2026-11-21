# Log: errors

- Reset to `batch/core`. Read brumate's `#try` first: it marks a failed region on the server with a boundary and a flag; here the state is one digit in the marker, `0` ok and `1` failed.
- The catch view is not patched. Walking it in the planner would create bindings for a view that exists only on failure.
- The catch view is inlined into client templates so a region added by a patch can start failed.
