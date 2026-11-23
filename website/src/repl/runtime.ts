// The loader of a REPL run. The frame loads it as an app loads `idlip/client`. The client chunks
// of the run import `idlip/client` and `idlip` through a module that reads this object, so
// they share the one loader. Vite builds this file as a worker bundle, which keeps no exports.
import * as core from 'idlip';
import * as client from 'idlip/client';

/** The key `project.ts` reads in the frame. Keep the two in step. */
Reflect.set(globalThis, '__idlipFrame', { ...core, ...client });
