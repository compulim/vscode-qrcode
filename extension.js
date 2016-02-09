'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const
  fs = require('fs'),
  path = require('path'),
  Q = require('q'),
  QRCode = require('qrcode-generator'),
  vscode = require('vscode'),
  ERROR_CORRECTIONS = [{
    label: 'L',
    description: 'Low error correction rate',
    detail: '7% of codewords can be restored'
  }, {
    label: 'M',
    description: 'Medium error correction rate',
    detail: '15% of codewords can be restored'
  }, {
    label: 'Q',
    description: 'Quartile error correction rate',
    detail: '25% of codewords can be restored'
  }, {
    label: 'H',
    description: 'High error correction rate',
    detail: '30% of codewords can be restored'
  }],
  FILENAME = 'qrcode.gif',
  MAX_VERSION = 40;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "compulim-qrcode" is now active!');

  vscode.workspace.registerTextDocumentContentProvider('qrcode-image', {
    provideTextDocumentContent: uri => {
      const query = parseQueryString('?' + uri.query);

      return `
        <div style="display: flex; height: 100%; width: 100%;">
          <div style="display: flex; flex: 1; flex-direction: column; justify-content: center;">
            <img src="data:;base64,${query.base64}" style="align-self: center;" />
          </div>
        </div>
      `;
    }
  });

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  var disposable = vscode.commands.registerCommand('qrcode.generateFromSelected', () => {
    // The code you place here will be executed every time your command is executed
    const filename = path.resolve(vscode.workspace.rootPath || '.', FILENAME);

    getSelectedTextOrPrompt('Text to convert into QR code')
      .then(text => {
        if (!text) { return; }

        vscode.window.showQuickPick(ERROR_CORRECTIONS)
          .then(level => {
            if (!level) { return; }

            exists(filename)
              .then(exists => {
                if (exists) {
                  return vscode.window.showQuickPick(['Yes', 'No'], {
                    placeHolder: `Do you want to overwrite "${filename}"?`,
                  });
                } else {
                  return 'Yes';
                }
              })
              .then(answer => {
                if (answer === 'Yes') {
                  const base64 = generateQRCodeAsBase64(text, level.label);

                  return Q.nfcall(
                    fs.writeFile,
                    filename,
                    new Buffer(base64, 'base64')
                  )
                    .then(() => {
                      vscode.commands.executeCommand('vscode.previewHtml', vscode.Uri.parse(`qrcode-image:qrcode.gif?base64=${encodeURIComponent(base64)}`));
                      // vscode.window.showInformationMessage(`QR code with message "${text}" has been generated to file "${filename}"`);
                    }, err => {
                      throw new Error(`Failed to generate QR code to file "${filename}" due to "${err.message}"`);
                    });
                }
              })
              .catch(err => {
                vscode.window.showErrorMessage(err.message);
              });
          });
      })
  });

  context.subscriptions.push(disposable);
}

function getSelectedTextOrPrompt(prompt) {
  const activeTextEditor = vscode.window.activeTextEditor;

  if (activeTextEditor) {
    const
      selection = activeTextEditor.selection,
      start = selection.start,
      end = selection.end;

    if (start.line !== end.line || start.character !== end.character) {
      return Q(activeTextEditor.document.getText(selection));
    }
  }

  return vscode.window.showInputBox({ prompt });
}

function generateQRCodeAsBase64(text, level) {
  let qrcode;

  for (let version = 1; version <= MAX_VERSION; version++) {
    qrcode = QRCode(version, level);
    qrcode.addData(text);

    try {
      qrcode.make();
      break;
    } catch (err) {
      qrcode = null;
      continue;
    }
  }

  if (!qrcode) {
    throw new Error('Failed to generate QR code, probably message is too large.');
  }

  const imageTag = qrcode.createImgTag();

  return (/base64,([^"]*)/.exec(imageTag) || [])[1];
}

function exists(filename) {
  return new Promise((resolve, reject) => fs.exists(filename, exists => resolve(exists)));
}

function parseQueryString(search) {
  const
    pattern = /[#\?&]([^=]+)(?:=([^&]+))?/g,
    query = {};

  let
    match,
    value;

  while ((match = pattern.exec(search))) {
    value = match[2];
    query[decodeURIComponent(match[1])] = value && decodeURIComponent(value);
  }

  return query;
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}

exports.deactivate = deactivate;