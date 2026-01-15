import { commands, Uri, window, workspace } from 'vscode';
import { CgEventsEditorProvider } from './CgEventsEditorProvider';
import { CgProjectParser } from './CgProjectParser';

async function promptForEventsFile(): Promise<Uri | undefined> {
    const pick = await window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Open .events file',
        filters: { Events: ['events'] },
    });
    return pick?.[0];
}

export async function openEventsAsJson(uri?: Uri): Promise<void> {
    try {
        const targetUri = uri ??
            window.activeTextEditor?.document.uri ??
            await promptForEventsFile();

        if (!targetUri) {
            window.showWarningMessage('Select a .events file first.');
            return;
        }

        const document = await workspace.openTextDocument(targetUri);
        const decoded = CgProjectParser.parseEvents(document.getText());
        if (decoded.format === "error") {
            const error = decoded.error instanceof Error ? decoded.error.message : decoded.error + '';
            window.showErrorMessage(error);
            return;
        }

        const jsonDoc = await workspace.openTextDocument({
            content: JSON.stringify(decoded.json, null, 2),
            language: 'json',
        });
        await window.showTextDocument(jsonDoc, { preview: false });
    } catch (e) {
        const error = e instanceof Error ? e.message : e + '';
        window.showErrorMessage(`Unable to open as JSON: ${error}`);
    }
}

export async function createEventsWithTemplate() {
    const uri = await window.showSaveDialog({
        saveLabel: "Create File",
        filters: { 'Code Gamelet Events': ['events'] }
    });

    if (!uri) {
        return;
    }

    await injectDefaultJsonToEvents(uri);
    await commands.executeCommand('vscode.openWith', uri, CgEventsEditorProvider.viewType);
}

export async function injectDefaultJsonToEvents(uri: Uri) {
    const workspaceFolder = workspace.getWorkspaceFolder(uri);
    const parser = CgProjectParser.getInstance(workspaceFolder);
    const json = await parser.getDefaultEvents();
    parser.removeLabel(null);
    const result = CgProjectParser.serializeEvents({ format: 'json', json });
    if (result.format === 'error') {
        const error = result.error instanceof Error ? result.error.message : `${result.error ?? ''}`;
        window.showErrorMessage(`Unable to serialize events: ${error}`);
        return;
    }
    return workspace.fs.writeFile(uri, Buffer.from(result.text, 'utf8'));
}
