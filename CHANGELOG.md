# Change Log

## 1.1.2

- Add a new configuration `clear-markdown-unused-images.excludeFolders` to allow users to configure excluded folders.

## 1.1.1

- Fix regex to handle filenames with spaces correctly (#6)
- Exclude 'unused-images' and 'node_modules' directories during file search (#7)

## 1.1.0

- Implement concurrent markdown scanning and parallel image movement.
- Add a progress bar for handling markdown and moving images.
- Fix regex issue with matching title text. [#5](https://github.com/therainisme/vscode-clear-markdown-unused-images/issues/5)

## 1.0.3

- Reduce the size of the extension package.

## 1.0.2

- Fix bug with clearing images that have the same name. [#3](https://github.com/therainisme/vscode-clear-markdown-unused-images/issues/3)

## 1.0.1

- Fix deletes too many images. [#1](https://github.com/therainisme/vscode-clear-markdown-unused-images/issues/1)

## 1.0.0

- Initial release