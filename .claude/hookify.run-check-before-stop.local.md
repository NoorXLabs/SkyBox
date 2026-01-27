---
name: run-check-before-stop
enabled: true
event: stop
pattern: .*
---

**Run linting before finishing!**

Before completing this task, run the check command to ensure code quality:

```bash
bun run check
```

This runs Biome linting + formatting to catch any issues introduced during this session.
