import * as pkg from "./package";
import * as core from "./core";


declare var require: any;
var ace: AceAjax.Ace = require("brace");

var lf = Util.lf

require('brace/mode/typescript');
require('brace/mode/javascript');
require('brace/mode/json');
require('brace/mode/c_cpp');
require('brace/mode/text');
require('brace/mode/markdown');
require('brace/mode/assembly_armthumb');

require('brace/theme/sqlserver');
require('brace/theme/tomorrow_night_bright');


var Range = (ace as any).acequire("ace/range").Range;


export class Wrapper {
    constructor(public editor: AceAjax.Editor)
    { }

    setTheme(inverted: boolean, fontSize: string) {
        let th = inverted ? 'ace/theme/tomorrow_night_bright' : 'ace/theme/sqlserver'
        if (this.editor.getTheme() != th) {
            this.editor.setTheme(th)
        }
        this.editor.setFontSize(fontSize)
    }

    getCursorPosition() {
        return this.editor.getCursorPosition()
    }

    getValue() {
        return this.editor.getValue()
    }

    lastSet: string;
    setValue(v: string) {
        this.lastSet = v;
        this.editor.setValue(v, -1)
    }

    loadFile(file: pkg.File) {
        let ext = file.getExtension()
        let modeMap: any = {
            "cpp": "c_cpp",
            "json": "json",
            "md": "markdown",
            "ts": "typescript",
            "js": "javascript",
            "asm": "assembly_armthumb"
        }
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]
        let sess = this.editor.getSession()
        sess.setMode('ace/mode/' + mode);
        this.editor.setReadOnly(file.isReadonly())
        this.setValue(file.content)
        
        this.loadDiagnostics(file)
    }

    loadDiagnostics(file: pkg.File) {
        let sess = this.editor.getSession();
        Object.keys(sess.getMarkers(true) || {}).forEach(m => sess.removeMarker(parseInt(m)))
        sess.clearAnnotations()
        if (file.diagnostics)
            for (let diagnostic of file.diagnostics) {
                const p0 = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                const p1 = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start + diagnostic.length)
                sess.addMarker(new Range(p0.line, p0.character, p1.line, p1.character),
                    "ace_error-marker", "ts-error", true)
            }
    }

    loadPosition(pos: AceAjax.Position) {
        this.editor.moveCursorToPosition(pos)
        this.editor.scrollToLine(pos.row - 1, true, false, () => { })
    }
}

export function mkAce(elt: string, chg: () => void) {
    let editor = ace.edit(elt)

    let sess = editor.getSession()
    sess.setNewLineMode("unix");
    sess.setTabSize(4);
    sess.setUseSoftTabs(true);
    editor.$blockScrolling = Infinity;

    let w = new Wrapper(editor)

    sess.on("change", () => {
        if (w.lastSet != null) {
            w.lastSet = null
        } else {
            chg();
        }
    })

    return w
}