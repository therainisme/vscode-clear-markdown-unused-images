import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

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
					progress.report({ message: 'Finding image files...', increment: 5 });
					const images = await vscode.workspace.findFiles('**/*.{png,jpg,jpeg,gif,bmp,tiff,webp,svg}');
					const imagePathsSet = new Set<string>(images.map(image => path.normalize(image.fsPath)));
					const totalImages = imagePathsSet.size;

					// Step 2: Find all Markdown files in the workspace
					progress.report({ message: 'Finding Markdown files...', increment: 10 });
					const markdowns = await vscode.workspace.findFiles('**/*.md');
					const totalMarkdowns = markdowns.length;
					let processedMarkdowns = 0;

					const cpuCount = os.cpus().length;
					console.log(`Detected ${cpuCount} CPU cores.`);

					// Define concurrency limits based on CPU cores
					const MARKDOWN_CONCURRENCY = cpuCount;
					const MOVE_CONCURRENCY = cpuCount;
					console.log(`Setting MARKDOWN_CONCURRENCY to ${MARKDOWN_CONCURRENCY}`);
					console.log(`Setting MOVE_CONCURRENCY to ${MOVE_CONCURRENCY}`);

					// Regex to match Markdown image syntax with optional comma and title
					// Match both normal paths and paths with spaces (in angle brackets)
					const imageRegex = /!\[.*?\]\((?:<([^>]+)>|([^)\s",]+))(?:\s*,?\s*["'][^"']*["'])?\)/g;

					// Step 3: Process each Markdown file with controlled concurrency
					progress.report({ message: 'Processing Markdown files...', increment: 15 });

					// Define the helper function inside the main function to access 'processedMarkdowns'
					const processMarkdownFiles = async () => {
						const concurrency = MARKDOWN_CONCURRENCY;
						const queue = [...markdowns];
						let active = 0;

						return new Promise<void>((resolve) => {
							const next = () => {
								if (queue.length === 0 && active === 0) {
									resolve();
									return;
								}

								while (active < concurrency && queue.length > 0) {
									const markdown = queue.shift()!;
									active++;
									processSingleMarkdown(markdown, imageRegex, imagePathsSet)
										.then(() => {
											processedMarkdowns++;
											// Calculate progress increment based on processedMarkdowns
											const increment = (processedMarkdowns / totalMarkdowns) * 25; // 15% to 40%
											progress.report({ message: `Processing Markdown files (${processedMarkdowns}/${totalMarkdowns})...`, increment: increment });
										})
										.catch(() => {
											// Even on error, increment processedMarkdowns
											processedMarkdowns++;
											const increment = (processedMarkdowns / totalMarkdowns) * 25;
											progress.report({ message: `Processing Markdown files (${processedMarkdowns}/${totalMarkdowns})...`, increment: increment });
										})
										.finally(() => {
											active--;
											next();
										});
								}
							};

							next();
						});
					};

					await processMarkdownFiles();

					// Step 4: Identify unused images
					progress.report({ message: 'Identifying unused images...', increment: 40 });
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
					try {
						await fs.mkdir(unusedImagesDir, { recursive: true });
					} catch (mkdirError) {
						console.error(`Failed to create directory ${unusedImagesDir}:`, mkdirError);
						vscode.window.showErrorMessage(`Failed to create directory ${unusedImagesDir}.`);
						return;
					}

					// Step 6: Move unused images with controlled concurrency
					progress.report({ message: 'Moving unused images...', increment: 55 });
					let movedCount = 0;

					const moveUnusedImages = async () => {
						const concurrency = MOVE_CONCURRENCY;
						const queue = [...unusedImages];
						let active = 0;

						return new Promise<number>((resolve) => {
							const next = () => {
								if (queue.length === 0 && active === 0) {
									resolve(movedCount);
									return;
								}

								while (active < concurrency && queue.length > 0) {
									const unusedImage = queue.shift()!;
									active++;
									moveSingleImage(unusedImage, workspaceRootPath, unusedImagesDir)
										.then((moved) => {
											if (moved) {
												movedCount++;
											}
											// Calculate progress increment based on movedCount
											const increment = (movedCount / totalUnused) * 25; // 55% to 80%
											progress.report({ message: `Moving images (${movedCount}/${totalUnused})...`, increment: increment });
										})
										.catch(() => {
											// Continue even if an error occurs
											const increment = (movedCount / totalUnused) * 25;
											progress.report({ message: `Moving images (${movedCount}/${totalUnused})...`, increment: increment });
										})
										.finally(() => {
											active--;
											next();
										});
								}
							};

							next();
						});
					};

					movedCount = await moveUnusedImages();

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
 * Processes a single Markdown file to extract and mark used images.
 * @param markdown URI of the Markdown file
 * @param regex Regular expression to match image syntax
 * @param imagePathsSet Set of image paths to track usage
 */
async function processSingleMarkdown(
	markdown: vscode.Uri,
	regex: RegExp,
	imagePathsSet: Set<string>
) {
	try {
		const document = await vscode.workspace.openTextDocument(markdown);
		const text = document.getText();
		let match: RegExpExecArray | null;

		while ((match = regex.exec(text)) !== null) {
			// match[1] is for paths with angle brackets, match[2] is for normal paths
			let imagePath = match[1] || match[2];

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
	} catch (error) {
		console.error(`Failed to process Markdown file ${markdown.fsPath}:`, error);
	}
}

/**
 * Moves a single unused image to the "unused-images" directory.
 * @param unusedImage Path of the unused image
 * @param workspaceRootPath Root path of the workspace
 * @param unusedImagesDir Directory to move unused images to
 * @returns Boolean indicating whether the move was successful
 */
async function moveSingleImage(
	unusedImage: string,
	workspaceRootPath: string,
	unusedImagesDir: string
): Promise<boolean> {
	const relativeImagePath = path.relative(workspaceRootPath, unusedImage);
	const targetPath = path.join(unusedImagesDir, relativeImagePath);
	const targetDir = path.dirname(targetPath);

	try {
		// Ensure the target directory exists
		await fs.mkdir(targetDir, { recursive: true });

		// Move the file
		await fs.rename(unusedImage, targetPath);
		console.log(`Moved ${unusedImage} to ${targetPath}`);
		return true;
	} catch (error) {
		console.error(`Failed to move ${unusedImage}:`, error);
		return false;
	}
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() { }