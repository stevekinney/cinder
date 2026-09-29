# Review feedback

Address open comments. Resolved comments are historical context. Verify outdated locations against current content before acting.

Scope: all saved comments
Records: 3; message bodies: 3; open: 2; resolved: 1; outdated: 1

## Target left: src/shared.ts

### Comment comment-file

State: open, current
Snapshot: left-snapshot
ID: ["diff","comment-file"]
File: old=src/shared.ts, new=src/shared.ts
Revision: main → feature/left
Repository: org/repo
Location: file comment

Feedback:

```
Please add a docstring here.
```

### Comment comment-resolved

State: resolved, current
Snapshot: left-snapshot
ID: ["diff","comment-resolved"]
File: old=src/shared.ts, new=src/shared.ts
Revision: main → feature/left
Repository: org/repo
Location: new side, raw-source lines 10–12

Quoted source:

```
// before-2
// before-1
function shared() {
  return 1;
}
// after-1
// after-2
```

Feedback:

```
Nice cleanup.
```

## Target right: src/shared.ts

### Comment comment-outdated

State: open, outdated (verification needed)
Snapshot: right-snapshot-old
ID: ["diff","comment-outdated"]
File: old=src/shared.ts, new=src/shared.ts
Revision: main → feature/right
Repository: org/repo
Location: old side, raw-source line 5

Quoted source:

```
return legacy();
```

Feedback:

```
This branch is now dead code.
```
