
//// <reference path="../node_modules/@kusto/language-service-next/Kusto.Language.Bridge.d.ts" />
/// <reference path = "../../InsightsParser_Bridge/Kusto.Language.Bridge.d.ts" />
/// <reference path="./typings/MissingFromBridge.d.ts" />
/// <reference path="./typings/refs.d.ts" />
import './bridge.min';
import './Kusto.Language.Bridge.min';

import {
    createConnection,
    TextDocuments,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    Hover,
    TextEdit,
    DocumentFormattingParams,
    Position,
    TextDocumentChangeEvent
} from 'vscode-languageserver';

import { getVSCodeCompletionItemsAtPosition } from './kustoCompletion';
import getGlobalState from './globalStateJson';

interface InsightsBlock
{
	text: string;
	start: number;
	end: number;
}


interface PositionedCodeScript {

    codeScript: Kusto.Language.Editor.CodeScript;
    
    //Line no. where insights block starts
    start: number;
    end: number;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

// Create a collection of Kusto code services, one for each document
type documentURI = string;
let temp: Kusto.Language.GlobalState = getGlobalState();
let kustoGlobalState: Kusto.Language.GlobalState = temp!=null ? temp : Kusto.Language.GlobalState.Default;
let kustoCodeScripts: Map<documentURI, PositionedCodeScript[]> = new Map();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

var data  = {value: 1};

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );

    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider: true,
            documentFormattingProvider: true,
        }
    };
});

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

// The example settings
interface Settings {
	diagnosticsEnabled: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { 
	diagnosticsEnabled: false
};
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <Settings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	//documents.all().forEach(validateTextDocument);
	documents.all().forEach(validateDocument);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'insightsLanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	var positionedCodeScripts = getPositionedCodeScripts(getInsightsBlocks(change.document));
    if(positionedCodeScripts == null)
    {
        connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
        return;
    }

	kustoCodeScripts.set(change.document.uri, positionedCodeScripts);
	
	validateDocument(change.document);
})

function getPositionedCodeScripts(blocks: InsightsBlock[]): PositionedCodeScript[]
{
    if(blocks == null)
        return null;

	var positionedCodeScripts: PositionedCodeScript[] = [];
	blocks.forEach(block => {
		var codeScript = Kusto.Language.Editor.CodeScript.From$1(block.text, kustoGlobalState);
		positionedCodeScripts.push({codeScript: codeScript, start: block.start, end:block.end} as PositionedCodeScript);
	});
	return positionedCodeScripts;
}


function getInsightsBlocks(document: TextDocument): InsightsBlock[]
{
	var text = document.getText();

	var newLineOrInsightsBlock = /((?<!```insights)\n)|((?<=```insights)[^`]*)/g;
	var reduced = text.match(newLineOrInsightsBlock);

    if(reduced == null)
        return null;

	var blocks: InsightsBlock[] = [];
	var line = 0;
	reduced.forEach(block => {
		if(block.length == 1)
		{
			line += 1;
			return;
		}

        var newLineArray = block.match(/\n/g);
        var lines = 0;
        if(newLineArray != null)
		    lines = newLineArray.length;

		var start = line + 1;
		var end = line + 1 + lines - 2;
		line += lines;

		blocks.push({text: block.trim(), start: start, end: end} as InsightsBlock);
	});

	return blocks;
}

function getPositionedCodeScriptAtDocumentPosition(_textDocumentPosition: TextDocumentPositionParams): PositionedCodeScript
{
    var positionedCodeScripts = kustoCodeScripts.get(_textDocumentPosition.textDocument.uri);
	var line = _textDocumentPosition.position.line;

	for(var i = 0; i<positionedCodeScripts.length; ++i)
	{
		if(line >= positionedCodeScripts[i].start && line <= positionedCodeScripts[i].end)
			return positionedCodeScripts[i];
	}
	return undefined;
}

function getCodeScriptAtDocumentPosition(_textDocumentPosition: TextDocumentPositionParams): Kusto.Language.Editor.CodeScript
{
	var positionedCodeScript = getPositionedCodeScriptAtDocumentPosition(_textDocumentPosition);

    if(positionedCodeScript != undefined)
        return positionedCodeScript.codeScript;
    return undefined;
}

async function validateDocument(document: TextDocument): Promise<void>
{
	const settings = await getDocumentSettings(document.uri);
	if (!settings.diagnosticsEnabled) {
		connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
		return;
	}

	const codeScripts = kustoCodeScripts.get(document.uri);
	let documentDiagnostics: Diagnostic[] = [];

	codeScripts.forEach(codeScript => {

		const startOffset = document.offsetAt({line: codeScript.start, character: 0});

		var kustoCodeScript = codeScript.codeScript;
		const blocks = kustoCodeScript.Blocks;
		for (let i=0; i < blocks.Count; i++) {
			let block = blocks._items[i];
			let diagnostics = block.Service.GetDiagnostics();
			for (let j=0; j < diagnostics.Count; j++) {
				let diagnostic = diagnostics.Items._items[j];
				documentDiagnostics.push({
					severity: DiagnosticSeverity.Error,
					range: {
					start: document.positionAt(diagnostic.Start + startOffset),
					end: document.positionAt(diagnostic.End + startOffset)
					},
					message: diagnostic.Message
				})
			}
		}
	});

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: document.uri, diagnostics: documentDiagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        // The pass parameter contains the position of the text document in
        // which code complete got requested. For the example we ignore this
        // info and always provide the same completion items.

        const positionedCodeScript = getPositionedCodeScriptAtDocumentPosition(_textDocumentPosition);
        if (positionedCodeScript === undefined) {
            return [];
        }

        try {
            return getVSCodeCompletionItemsAtPosition(positionedCodeScript.codeScript, _textDocumentPosition.position.line - positionedCodeScript.start + 1, _textDocumentPosition.position.character + 1)
        } catch (e) {
            connection.console.error(e + "");
            return [];
        }
    }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    }
);

connection.onHover(
    (params: TextDocumentPositionParams): Hover | null => {
        const positionedCodeScript = getPositionedCodeScriptAtDocumentPosition(params);
        if(positionedCodeScript == undefined)
            return {contents: ""};

        const kustoCodeScript = positionedCodeScript.codeScript;
        if (kustoCodeScript !== undefined) {
            let position = {v:-1};
            let positionValid = kustoCodeScript.TryGetTextPosition(params.position.line - positionedCodeScript.start + 1, params.position.character + 1, position);
            const kustoCodeBlock = kustoCodeScript.GetBlockAtPosition(position.v);
            const quickInfo = kustoCodeBlock.Service.GetQuickInfo(position.v);

            return {contents: quickInfo.Text};
        }
        return null;
    }
)

/*connection.onDocumentFormatting(
    (params: DocumentFormattingParams): TextEdit[] | null => {
        const kustoCodeScript = kustoCodeScripts.get(params.textDocument.uri)[0].codeScript; //Just a temporary change to get rid of diagnostics. Would have maybe initiate loop for each script
        if (kustoCodeScript === undefined) {
            return null;
        }

        let formatted: string = formatCodeScript(kustoCodeScript);
        let changes:TextEdit[] = [TextEdit.replace({
            start: {line: 0, character: 0},
            end: {line: Number.MAX_VALUE, character: Number.MAX_VALUE}
        }, formatted)];
        return changes;
    }
)*/

/*
connection.onDidOpenTextDocument((params) => {
    // A text document got opened in VSCode.
    // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
    // params.text the initial full content of the document.
    connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
    // The content of a text document did change in VSCode.
    // params.uri uniquely identifies the document.
    // params.contentChanges describe the content changes to the document.
    connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
    // A text document got closed in VSCode.
    // params.uri uniquely identifies the document.
    connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();