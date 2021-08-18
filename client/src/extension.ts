/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, commands, window } from 'vscode';
import * as keytar from 'keytar';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	RequestType
} from 'vscode-languageclient';

let client: LanguageClient;
let accessToken = "";
let scope = "";
const service = "Github Insights"

export async function activate(context: ExtensionContext) {
	await getAccessToken();

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for markdown documents
		documentSelector: [{ scheme: 'file', language: 'markdown' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'insightsLanguageServer',
		'Insights Language Server',
		serverOptions,
		clientOptions
	);
	// Start the client. This will also launch the server
	client.start();

	let disposableSetCredential = commands.registerCommand("insights.setCredential", async () => {

		const account = await window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: 'Account ID',
			prompt: "Enter the GitHub Account ID"
		})
		if(!account)
		{
			window.showErrorMessage("Account Required");
			return;
		}

		const token = await window.showInputBox({
			ignoreFocusOut: true,
			password: true,
			placeHolder: "Access Token",
			prompt: "Enter the Access Token string"
		})
		if(!token)
		{
			window.showErrorMessage("Token Required");
			return;
		}

		//Overwrite existing credentials
		var credentials = await keytar.findCredentials(service);
		if(credentials.length)
			await keytar.deletePassword(service, credentials[0].account);
		await keytar.setPassword(service, account, token);
		accessToken = token;
		scope = account;

		window.showInformationMessage("Credentials Set Successfully");
	})

	context.subscriptions.push(disposableSetCredential);

	return {
		extendMarkdownIt(md) {
			const highlight = md.options.highlight;
			md.options.highlight = (code, lang) => {
				if(lang && lang.match(/\binsights\b/i))
					return `<div access-token="${accessToken}" scope=${scope}>${code}</div>`
				return highlight(code, lang);
			}
			return md;
		}
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

async function getAccessToken()
{
	var credentials = await keytar.findCredentials(service);
	if(credentials.length) {
		accessToken = credentials[0].password;
		scope = credentials[0].account;
	}
	else
		window.showErrorMessage("No credentials found for Insights Web Service");
}