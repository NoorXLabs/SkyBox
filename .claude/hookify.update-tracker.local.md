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
3. **Update PROJECT.md:** Mark completed items with `[x]` in the Remaining Work section

**Using Task Tools:**
```
TaskList - View all current tasks and their status
TaskUpdate { taskId: "1", status: "completed" } - Mark task as done
```

**Updating PROJECT.md:**
Find the task in Section 6 (Remaining Work) and update:
```markdown
### Minor Improvements
- [x] Add lock status check in `shell` command ✓ (commit: abc1234)
- [ ] Create actual template repositories
```

Only update if implementation tasks were actually completed in this session.
