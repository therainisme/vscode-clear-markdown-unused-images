import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "clear-markdown-unused-images" is now active!');

	let disposable = vscode.commands.registerCommand('clear-markdown-unused-images.run', async () => {
		vscode.window.showInformationMessage('Searching for unused images in markdown files...');

		try {
			// Find all image files in the workspace
			const images = await vscode.workspace.findFiles('**/*.{png,jpg,jpeg,gif,bmp,tiff,webp,svg}');
			const imagePathsSet = new Set<string>(images.map(image => path.normalize(image.fsPath)));

			// Find all Markdown files in the workspace
			const markdowns = await vscode.workspace.findFiles('**/*.md');
			// Regex to match Markdown image syntax with optional comma and title
			const imageRegex = /!\[.*?\]\(([^)\s",]+)(?:\s*,?\s*["'][^"']*["'])?\)/g;

			for (const markdown of markdowns) {
				const document = await vscode.workspace.openTextDocument(markdown);
				const text = document.getText();
				let match: RegExpExecArray | null;

				while ((match = imageRegex.exec(text)) !== null) {
					let imagePath = match[1];

					// Ignore network images
					if (/^(http|https):\/\//.test(imagePath)) {
						continue;
					}

					// Resolve absolute and relative image paths
					if (path.isAbsolute(imagePath)) {
						const workspaceRootPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
						imagePath = path.join(workspaceRootPath, imagePath);
					} else {
						imagePath = path.resolve(path.dirname(markdown.fsPath), imagePath);
					}

					// Normalize the image path
					imagePath = path.normalize(imagePath);

					// Handle case-insensitive file systems (e.g., Windows)
					const normalizedImagePath = process.platform === 'win32' ? imagePath.toLowerCase() : imagePath;

					// Remove used images from the set
					for (const key of imagePathsSet) {
						const normalizedKey = process.platform === 'win32' ? key.toLowerCase() : key;
						if (normalizedKey === normalizedImagePath) {
							imagePathsSet.delete(key);
							break;
						}
					}
				}
			}

			const unusedImages = Array.from(imagePathsSet);

			if (unusedImages.length === 0) {
				vscode.window.showInformationMessage('No unused images found.');
				return;
			}

			const workspaceRootPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
			const unusedImagesDir = path.join(workspaceRootPath, "unused-images");

			// Create the "unused-images" directory if it doesn't exist
			if (!fs.existsSync(unusedImagesDir)) {
				fs.mkdirSync(unusedImagesDir, { recursive: true });
			}

			let movedCount = 0;
			for (const unusedImage of unusedImages) {
				const relativeImagePath = path.relative(workspaceRootPath, unusedImage);
				const targetPath = path.join(unusedImagesDir, relativeImagePath);
				const targetDir = path.dirname(targetPath);

				// Ensure the target directory exists
				if (!fs.existsSync(targetDir)) {
					fs.mkdirSync(targetDir, { recursive: true });
				}

				try {
					fs.renameSync(unusedImage, targetPath);
					console.log(`Moved ${unusedImage} to ${targetPath}`);
					movedCount++;
				} catch (error) {
					console.error(`Failed to move ${unusedImage}:`, error);
				}
			}

			vscode.window.showInformationMessage(`Moved ${movedCount} unused images to ${unusedImagesDir}`);
		} catch (error) {
			console.error('Error while processing images:', error);
			vscode.window.showErrorMessage('An error occurred while searching for unused images.');
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }