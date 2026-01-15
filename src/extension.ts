import { name } from 'package.json';
import { commands, ExtensionContext, Uri } from "vscode";
import { CgEventsEditorProvider } from './CgEventsEditorProvider';
import { CgProjectParser } from './CgProjectParser';
import { createEventsWithTemplate, openEventsAsJson } from './command';

export function activate(context: ExtensionContext): void {
	context.subscriptions.push(
		...CgEventsEditorProvider.setupWatcher(),
		...CgProjectParser.setupWatcher(),
		CgEventsEditorProvider.register(context),
		commands.registerCommand(`${name}.openEventsAsJson`, (uri?: Uri) => {
			return openEventsAsJson(uri);
		}),
		commands.registerCommand(`${name}.createEventsWithTemplate`, () => {
			return createEventsWithTemplate();
		})
	);
}

export function deactivate(): void {

}
