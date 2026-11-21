# sources

- Build a source on `listen` (`channel.ts`) and open its handle on the first `next()`. Why: a generator that never started does not run its body, and an await outside the signal leaves a queued `return()` stuck.
- Yield text from `socket` and `eventSource`. Why: each value is serialized in the message log.
