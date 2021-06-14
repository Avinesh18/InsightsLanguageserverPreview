
//Commented off to avoid building

/*
//// <reference path="../node_modules/@kusto/language-service-next/Kusto.Language.Bridge.d.ts" />
/// <reference path = "../../kql_bridge/Kusto.Language.Bridge.d.ts" />
/// <reference path="./typings/MissingFromBridge.d.ts" />
/// <reference path="./typings/refs.d.ts" />
import './bridge.min';
import './Kusto.Language.Bridge';

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

import { getClient as getKustoClient, TokenResponse, getFirstOrDefaultClient } from './kustoConnection';
import { getSymbolsOnCluster, getSymbolsOnTable } from './kustoSymbols';
import { formatCodeScript } from './kustoFormat';
import { getVSCodeCompletionItemsAtPosition } from './kustoCompletion';
import {getGlobalState} from './globalStateJson'
import { start } from 'repl';
import { endsWith } from 'lodash';
import { closeSync } from 'fs';

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

interface InsightsBlock
{
	text: string;
	start: number;
	end: number;
}

function getInsightsBlock(document: TextDocument): InsightsBlock[]
{
	var text = document.getText();

	var newLineOrInsightsBlock = /((?<!```insights)\n)|((?<=```insights)[^`]*)/g;
	var reduced = text.match(newLineOrInsightsBlock);

	var blocks: InsightsBlock[] = [];
	var line = 1;
	reduced.forEach(block => {
		if(block.length == 1)
		{
			line += 1;
			return;
		}

		var lines = block.match(/\n/g).length;

		var start = line + 1;
		var end = line + 1 + lines - 2;
		line += lines;

		blocks.push({text: block, start: start, end: end} as InsightsBlock);
	});

	return blocks;
}

function getCodeScripts(blocks: InsightsBlock[]): PositionedCodeScript[]
{
	var positionedCodeScripts: PositionedCodeScript[] = [];
	blocks.forEach(block => {
		var codeScript = Kusto.Language.Editor.CodeScript.From$1(block.text, kustoGlobalState);
		positionedCodeScripts.push({codeScript: codeScript, start: block.start, end:block.end} as PositionedCodeScript);
	});
	return positionedCodeScripts;
}

documents.onDidChangeContent(change => {
	var codeScripts = getCodeScripts(getInsightsBlock(change.document));
	kustoCodeScripts.set(change.document.uri, codeScripts);
	
	validateDocument(change.document);
})

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

function getCodeScriptAtDocumentPosition(_textDocumentPosition: TextDocumentPositionParams): Kusto.Language.Editor.CodeScript
{
	var codeScripts = kustoCodeScripts.get(_textDocumentPosition.textDocument.uri);
	var line = _textDocumentPosition.position.line;

	for(var i = 0; i<codeScripts.length; ++i)
	{
		if(line >= codeScripts[i].start && line < codeScripts[i].end)
			return codeScripts[i].codeScript;
	}
	return undefined;
}

connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        // The pass parameter contains the position of the text document in
        // which code complete got requested. For the example we ignore this
        // info and always provide the same completion items.

        //const kustoCodeScript = kustoCodeScripts.get(_textDocumentPosition.textDocument.uri)[0].codeScript; //Just a temporary change to get rid of diagnostics. Would have to check line no. to get actual code script
		const kustoCodeScript = getCodeScriptAtDocumentPosition(_textDocumentPosition);
        if (kustoCodeScript === undefined) {
            return [];
        }

        try {
            return getVSCodeCompletionItemsAtPosition(kustoCodeScript, _textDocumentPosition.position.line + 1, _textDocumentPosition.position.character + 1)
        } catch (e) {
            connection.console.error(e);
            return [];
        }
    }
);

*/