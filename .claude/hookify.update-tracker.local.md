---
name: update-task-tracker
enabled: true
event: stop
pattern: .*
---

## Before stopping, update the Task Tracker

If you completed any tasks from the current plan, use the TaskList and TaskUpdate tools:

1. **Check completed tasks:** Use `TaskList` to see all tasks
2. **Mark completed:** Use `TaskUpdate` with `status: "completed"` for finished tasks
3. **Update IMPLEMENTATION.md:** Mark completed items with `[x]` in the appropriate phase section

**Using Task Tools:**
```
TaskList - View all current tasks and their status
TaskUpdate { taskId: "1", status: "completed" } - Mark task as done
```

**Updating plans/IMPLEMENTATION.md:**
Find the task by number in the appropriate phase and update:
```markdown
- [x] **Task 1:** Fix shell injection vulnerability in lock.ts
  - Location: `src/lib/lock.ts:104, 130`
  - Fix: Use base64 encoding or proper shell escaping
  - Commit: `abc1234`
```

Also add the commit to the **Commits Log** table at the bottom:
```markdown
| `abc1234` | fix(security): prevent shell injection in lock.ts | Task 1 |
```

Only update if implementation tasks were actually completed in this session.
