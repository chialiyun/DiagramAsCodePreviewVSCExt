// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const command = 'diagramspreviewer.start';

	const docPath = () => vscode.window.activeTextEditor?.document.uri.path ?? "";

	const isValidFileExtension = () => path.extname(docPath()) === '.py';

	const outDirectory = path.join(context.extensionPath, "media", "out");
	const targetFile = path.join(outDirectory, `test.png`);
	const targetSrcFile = path.join(outDirectory, `test.py`);
	const targetFilePathWithoutExt = path.join(outDirectory, `test`);

	const createWebViewContent = () => {
		var data = fs.readFileSync(targetFile).toString('base64');

		const content = `<!DOCTYPE html>
			<html>
			  <body>
				<img src="data:image/png;base64, ${data}">
			  </body>
			</html>`;

		return content;
	}

	const generateDiagram = async (panel: vscode.WebviewPanel) => {
		const proc = require('child_process');
		const cmd = `python3 ${targetSrcFile}`;

		// execute command
		proc.exec(cmd, (err: string, stdout: string, stderr: string) => {
			if (err) {
				console.log('error: ' + err);
				vscode.window.showErrorMessage("Error executing the code, please make sure you have Python3 (3.6 or higher) and Graphviz installed.");
				return;
			}
			panel.webview.html = createWebViewContent();
		});
	}

	const updateTempSourceFile = (panel: vscode.WebviewPanel) => {
		const editor = vscode.window.activeTextEditor;

		let line = 0, wordLine, textRange, wholeText, finalSrc = '';
		const lineCount = editor?.document.lineCount;

		// find the with Diagram line
		do {
			wordLine = editor?.document.lineAt(line)
			textRange = new vscode.Range(wordLine?.range?.start!, wordLine?.range?.end!);
			wholeText = editor?.document.getText(textRange)

			line++;
			
			if (!wholeText?.includes("with Diagram"))
				finalSrc = `${finalSrc}${wholeText}\n`;
		} while(!wholeText?.includes("with Diagram"));

		// Get `withDiagram args`
		const opening = wholeText.indexOf('(');
		const closing = wholeText.indexOf(')');
		const args = wholeText.substring(opening+1, closing).split(",");

		// Form `withDiagram` line
		let withDiagram = 'with Diagram(';
		args.forEach(x => {
			if (!x.includes('fileName')) 
				withDiagram = `${withDiagram}${x},`
		});
		withDiagram = `${withDiagram}filename="${targetFilePathWithoutExt}",`

		withDiagram = `${withDiagram}):\n`

		// Add `withDiagram` line
		finalSrc = `${finalSrc}${withDiagram}`;

		var pos1 = new vscode.Position(line, 0);
		var pos2 = new vscode.Position(lineCount!, 0);
		wholeText = editor?.document.getText(new vscode.Range(pos1, pos2));

		// Add the rest of the code
		finalSrc = `${finalSrc}${wholeText}`;

		// write to file
		fs.mkdir(outDirectory, { recursive: true }, (err) => {
			if (err) throw err;

			fs.writeFile(targetSrcFile, finalSrc, err => {
				if (err)
					console.log(err);
				else
					generateDiagram(panel);
			});	
		});

	}

	const commandHandler = () => {

		// Validation
		if (!isValidFileExtension()) {
			vscode.window.showErrorMessage('Sorry, only python files are supported.');
			return;
		}

		vscode.window.showInformationMessage('Generating diagram preview...');

		// TODO: check if python is installed, check if the graphviz is installed

		const panel = vscode.window.createWebviewPanel(
			'diagramsPreview', 'Diagrams Preview',
			vscode.ViewColumn.Two,
			{
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media', 'out'))],
				enableScripts: true
			}
		);

		vscode.workspace.onDidSaveTextDocument((e) => {
			vscode.window.showInformationMessage('Reflecting new changes to diagram preview...');

			updateTempSourceFile(panel);
		});

		updateTempSourceFile(panel);
	}

	context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
}

// this method is called when your extension is deactivated
export function deactivate() {}
