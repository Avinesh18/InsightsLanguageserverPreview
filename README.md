# Insights Language Server

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```

## Dev workflow

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a `.md` document

After generating js files for Insights Parser using Bridge, the files `bridge.min.js` and `Kusto.Language.Bridge.min.js` must be copied to `./server/out` folder.

Also some minor changes must be made in `Kusto.Language.Bridge.d.ts` regarding types of some interfaces and fields. These changes can be found here: https://github.com/github/insights-prototypes/commit/a7e7cb708035dfe4a7a4010f1e89fc4f402b04b3#diff-028e9d21b1a882e1b69493a25fccde326cd0dee4b1caf92f2bd4953f7e4cd448
