---
title: Introduction
order: 0
section: Start
description: What idlip is and where the guide goes next.
---

idlip is a UI framework where the server renders the page and the browser resumes it. No view code runs on load. A click loads one update handler and only the bindings whose model paths changed.

A module is a function component. `let` is state, `const` is derived, function declarations are handlers and `return` is the view.

```tsx fragment
<ul>
  <li>Resumes, does not hydrate</li>
</ul>
```

This page is a placeholder. The page nodes of the roadmap add the guide.
