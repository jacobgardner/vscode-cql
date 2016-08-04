import vscode = require('vscode');
import cassandra = require('cassandra-driver');
import resultDocProvider = require('./cqlResultDocumentProvider');
import uuid = require('uuid');

export let currentResults = {};

export function registerExecuteCommand() : vscode.Disposable {
    return vscode.commands.registerCommand('cql.execute', ()=> {
        
        console.log('Configuring cql statement execution.');
        
        let cassandraAddress = vscode.workspace.getConfiguration("cql")["address"];
        let cassandraPort = vscode.workspace.getConfiguration("cql")["port"];

        let cassandraConnectionOptions = vscode.workspace.getConfiguration("cql")["connection"];

        let clientOptions = !!cassandraConnectionOptions 
            ? cassandraConnectionOptions 
            : {
                contactPoints: [cassandraAddress],
                hosts: [cassandraAddress]
            };
        
        console.log('Cassandra connection configuration', clientOptions);
        
        let client = new cassandra.Client(clientOptions);
        
        var statement = "";
        if (vscode.window.activeTextEditor.selection.isEmpty) {
            statement = vscode.window.activeTextEditor.document.getText();
        }
        else {
            var selection = vscode.window.activeTextEditor.selection;
            statement = vscode.window.activeTextEditor.document.getText(new vscode.Range(selection.start, selection.end));
        }
        console.log("statement: " + statement);
        vscode.window.showInformationMessage(`Executing statement:"${statement}" against Cassandra @  + ${cassandraAddress}:${cassandraPort}`);

        client.connect(function (err, result) {
            client.execute(statement.toString(), [], { prepare: true }, function (err, result) {
                console.log('executed', err, result);
                if(err) {
                    currentResults = err;
                } else {
                    currentResults = result;
                }

                showResults(err, result);
            });
        });
    });
}

export function registerResultDocumentProvider() : vscode.Disposable {
    let provider = new resultDocProvider.cqlResultDocumentProvider();
    return vscode.workspace.registerTextDocumentContentProvider('cql-result', provider);
}

export function registerAll() : vscode.Disposable[] { //I like that.. I may keep this pattern.
    return [registerExecuteCommand(), registerResultDocumentProvider()];
}

function showResults(error, results) {
    if(vscode.workspace.getConfiguration("cql")["resultStyle"].location == "output") {
        let outputChannel = vscode.window.createOutputChannel(`CQL Results`);
        outputChannel.clear();
        outputChannel.appendLine("Results:");
        outputChannel.appendLine(JSON.stringify(error ? error : currentResults));
        outputChannel.show();
    } else {
        let resultUri = "cql-result://api/results" + uuid.v4();
        vscode.commands.executeCommand('vscode.previewHtml', resultUri, vscode.ViewColumn.Two, 'Cassandra Results')
            .then((success) => {
                //do nothing it worked already...
            }, (reason) => {
                vscode.window.showErrorMessage(reason);
            });
    }
}