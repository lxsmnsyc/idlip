// The one script of the site. Each feature is a file in `client/` and runs on import, so a new
// feature (search, the REPL link) adds a file and edits nothing here.
import './styles.css';

import.meta.glob('./client/*.ts', { eager: true });
