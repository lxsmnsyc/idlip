# idlip

A resumable UI framework built on Model-View-Update.

The server renders the page and writes the model and the messages into the HTML. The client continues from that state on the first event. It loads only the update handler for that message and the view bindings whose model paths changed.

Status: design stage. See [`docs/proposals/0001-dsl.md`](docs/proposals/0001-dsl.md).

## License

MIT
