# Clear Markdown Unused Images

[![isualStudioMarketplace](https://img.shields.io/badge/VisualStudioMarketplace-v1.1.2-green.svg)](https://marketplace.visualstudio.com/items?itemName=therainisme.clear-markdown-unused-images)

This extension moves unused images in Markdown files to the 'unused-images' folder.

## Usage

Press `Ctrl+Shift+P`(`Cmd+Shift+P` on Mac), type "`Clear Markdown Unused Images: Run`" and the extension will move unused images in Markdown files to the 'unused-images' folder.

![example.gif](https://raw.githubusercontent.com/therainisme/vscode-clear-markdown-unused-images/main/assets/example.gif)

## Configuration

You can configure the folders to be excluded from the image search by modifying the `clear-markdown-unused-images.excludeFolders` setting in your `settings.json` file.

By default, the following folders are excluded:
- `**/unused-images/**`
- `**/node_modules/**`

You can add your own glob patterns to this array to exclude other folders. For example:

```json
"clear-markdown-unused-images.excludeFolders": [
  "**/unused-images/**",
  "**/node_modules/**",
  "**/assets/**"
]
```

## Known Issues

No known issues at the moment.