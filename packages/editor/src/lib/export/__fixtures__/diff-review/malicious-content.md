# Review feedback

Address open comments. Resolved comments are historical context. Verify outdated locations against current content before acting.

## Review note

````
Note contains ``` a fence ``` and <b>bold-looking</b> text.
````

Scope: all saved comments
Records: 1; message bodies: 1; open: 1; resolved: 0; outdated: 0

## Target html-target: src/render.ts

### Comment comment-malicious

State: open, current
Snapshot: html-target-snapshot
ID: ["diff","comment-malicious"]
File: old=src/render.ts, new=src/render.ts
Location: new side, raw-source lines 1–2

Quoted source:

`````
```js
const x = "````closing four";
```
<script>alert(1)</script>
`````

Feedback:

```````
Escaping looks wrong here: `````` and <img src=x onerror=alert(1)> should never render.
```````
