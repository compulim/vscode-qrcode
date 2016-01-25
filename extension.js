'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const
  fs = require('fs'),
  open = require('open'),
  path = require('path'),
  Q = require('q'),
  QRCode = require('qrcode-generator'),
  vscode = require('vscode'),
  DEFAULT_ERROR_CORRECTION = 'L',
  FILENAME = 'qrcode.gif',
  MAX_VERSION = 40;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('Congratulations, your extension "compulim-qrcode" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  var disposable = vscode.commands.registerTextEditorCommand('qrcode.generateFromSelected', (textEditor, edit) => {
    // The code you place here will be executed every time your command is executed

    let
      selection = textEditor.selection,
      start = selection.start,
      end = selection.end;

    if (start.line === end.line && start.character === end.character) {
      selection = new vscode.Selection(new vscode.Position(start.line, 0), new vscode.Position(start.line, Infinity));
    }

    const selectedText = textEditor.document.getText(new vscode.Range(selection.start, selection.end));

    let qrcode;

    for (let version = 1; version <= MAX_VERSION; version++) {
      qrcode = QRCode(version, DEFAULT_ERROR_CORRECTION);
      qrcode.addData(selectedText);

      try {
        qrcode.make();
        break;
      } catch (err) {
        qrcode = null;
        continue;
      }
    }

    if (!qrcode) {
      return vscode.window.showErrorMessage('Failed to generate QR code, probably message is too large.');
    }

    const
      imageTag = qrcode.createImgTag(),
      base64 = (/base64,([^"]*)/.exec(imageTag) || [])[1],
      filename = path.resolve(vscode.workspace.rootPath || '.', FILENAME);

    exists(filename)
      .then(exists => {
        if (exists) {
          return vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: `Do you want to override "${filename}"?`,
          });
        } else {
          return 'Yes';
        }
      })
      .then(answer => {
        if (answer === 'Yes') {
          Q.nfcall(fs.writeFile, filename, new Buffer(base64, 'base64'))
            .then(() => {
              open(filename);
              vscode.window.showInformationMessage(`QR code of message "${selectedText}" has been generated to file "${filename}"`);
            })
            .catch(err => vscode.window.showErrorMessage(`Failed to generate QR code to file "${filename}" due to "${err.message}"`));
        }
      });
  });

  context.subscriptions.push(disposable);
}

function exists(filename) {
  return Q((resolve, reject) => fs.exists(filename, exists => resolve(exists)));
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}

exports.deactivate = deactivate;