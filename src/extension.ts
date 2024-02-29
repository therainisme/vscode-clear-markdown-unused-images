// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "clear-markdown-unused-images" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('clear-markdown-unused-images.clear', async () => {
		// The code you place here will be executed every time your command is executed
		vscode.window.showInformationMessage('Searching for unused images in markdown files...');

		const images = await vscode.workspace.findFiles('**/*.{png,jpg,jpeg,gif,bmp,tiff,webp,svg}');
		const imagesMap = images.reduce((acc, image) => {
			acc[image.fsPath] = false;
			return acc;
		}, {} as { [key: string]: boolean });

		const markdowns = await vscode.workspace.findFiles('**/*.md');
		for (const markdown of markdowns) {
			const document = await vscode.workspace.openTextDocument(markdown);
			const text = document.getText();
			const imagePaths = text.match(/!\[.*\]\((.*)\)/g);
			if (imagePaths) {
				imagePaths.forEach(imageRawPath => {
					// filter network images
					if (imageRawPath.startsWith("http")) {
						return;
					}

					let imagePath = imageRawPath.match(/!\[.*\]\((.*)\)/)![1];
					imagePath = path.join(markdown.fsPath, "../", imagePath);
					imagesMap[imagePath] = true;
				});
			}
		}

		const unusedImages = Object.keys(imagesMap).filter(imagePath => {
			return !imagesMap[imagePath];
		});

		const workspaceRootpath = vscode.workspace.workspaceFolders![0].uri.fsPath;
		const unusedImagesDir = path.join(workspaceRootpath, "unused-images");
		if (!fs.existsSync(unusedImagesDir)) {
			fs.mkdirSync(unusedImagesDir);
		}
		for (const unusedImage of unusedImages) {
			const unusedImageName = path.basename(unusedImage);
			fs.renameSync(unusedImage, path.join(unusedImagesDir, unusedImageName));
			console.log(`Moved ${unusedImage} to ${unusedImagesDir}`);
		}

		vscode.window.showInformationMessage(`Moved ${unusedImages.length} unused images to ${unusedImagesDir}`);
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
