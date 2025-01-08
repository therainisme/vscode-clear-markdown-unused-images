import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';

/**
 * This method is called when your extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "clear-markdown-unused-images" is now active!');

	let disposable = vscode.commands.registerCommand('clear-markdown-unused-images.run', async () => {
		// Start the progress bar
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Clear Markdown Unused Images",
				cancellable: false
			},
			async (progress) => {
				progress.report({ message: 'Initializing...', increment: 0 });

				try {
					// Step 1: Find all image files in the workspace
					progress.report({ message: 'Finding image files...', increment: 10 });
					const images = await vscode.workspace.findFiles('**/*.{png,jpg,jpeg,gif,bmp,tiff,webp,svg}');
					const imagePathsSet = new Set<string>(images.map(image => path.normalize(image.fsPath)));
					const totalImages = imagePathsSet.size;
					let processedImages = 0;

					// Step 2: Find all Markdown files in the workspace
					progress.report({ message: 'Finding Markdown files...', increment: 20 });
					const markdowns = await vscode.workspace.findFiles('**/*.md');
					const totalMarkdowns = markdowns.length;
					let processedMarkdowns = 0;

					// Regex to match Markdown image syntax with optional comma and title
					const imageRegex = /!\[.*?\]\(([^)\s",]+)(?:\s*,?\s*["'][^"']*["'])?\)/g;

					// Step 3: Process each Markdown file
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

						processedMarkdowns++;
						// Update progress for Markdown processing
						const markdownProgress = 20 + ((processedMarkdowns / totalMarkdowns) * 30);
						progress.report({ message: `Processing Markdown files (${processedMarkdowns}/${totalMarkdowns})...`, increment: (processedMarkdowns / totalMarkdowns) * 30 });
					}

					// Step 4: Identify unused images
					progress.report({ message: 'Identifying unused images...', increment: 60 });
					const unusedImages = Array.from(imagePathsSet);
					const totalUnused = unusedImages.length;

					if (unusedImages.length === 0) {
						vscode.window.showInformationMessage('No unused images found.');
						progress.report({ message: 'No unused images found.', increment: 100 });
						return;
					}

					// Step 5: Create the "unused-images" directory if it doesn't exist
					const workspaceRootPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
					const unusedImagesDir = path.join(workspaceRootPath, "unused-images");
					if (!fs.existsSync(unusedImagesDir)) {
						fs.mkdirSync(unusedImagesDir, { recursive: true });
					}

					// Step 6: Move unused images
					progress.report({ message: 'Moving unused images...', increment: 70 });
					let movedCount = 0;
					for (const [index, unusedImage] of unusedImages.entries()) {
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

						// Update progress for moving images
						const moveProgress = 70 + ((index + 1) / totalUnused) * 30;
						progress.report({ message: `Moving images (${index + 1}/${totalUnused})...`, increment: ((index + 1) / totalUnused) * 30 });
					}

					// Final progress update
					progress.report({ message: 'Cleanup complete.', increment: 100 });
					vscode.window.showInformationMessage(`Moved ${movedCount} unused images to ${unusedImagesDir}`);
				} catch (error) {
					console.error('Error while processing images:', error);
					vscode.window.showErrorMessage('An error occurred while searching for unused images.');
				}
			}
		);
	});

	context.subscriptions.push(disposable);
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() { }