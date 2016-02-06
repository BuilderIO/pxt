import * as workspace from "./workspace";
import * as data from "./data";
import * as core from "./core";

var lf = Util.lf

export class File {
    inSyncWithEditor = true;
    inSyncWithDisk = true;

    constructor(public epkg: EditorPackage, public name: string, public content: string)
    { }

    getName() {
        return this.epkg.yelmPkg.id + "/" + this.name
    }

    getExtension() {
        let m = /\.([^\.]+)$/.exec(this.name)
        if (m) return m[1]
        return ""
    }

    markDirty() {
        this.inSyncWithEditor = false;
        this.updateStatus();
    }

    private updateStatus() {
        data.invalidate("open-status:" + this.getName())
    }

    setContentAsync(newContent: string) {
        this.inSyncWithEditor = true;
        if (newContent != this.content) {
            this.inSyncWithDisk = false;
            this.content = newContent;
            this.updateStatus();
            data.invalidate("open:" + this.getName())
            return this.epkg.saveFilesAsync()
                .then(() => {
                    if (this.content == newContent) {
                        this.inSyncWithDisk = true;
                        this.updateStatus();
                    }
                })
        } else {
            this.updateStatus();
            return Promise.resolve()
        }
    }
}

export class EditorPackage {
    files: Util.StringMap<File> = {};
    header: workspace.Header;
    onupdate = () => { };
    saveScheduled = false;
    savingNow = 0;

    constructor(public yelmPkg: yelm.Package) {
        if (yelmPkg.verProtocol() == "workspace")
            this.header = workspace.getHeader(yelmPkg.verArgument())
    }

    setFiles(files: Util.StringMap<string>) {
        this.files = Util.mapStringMap(files, (k, v) => new File(this, k, v))
    }

    private updateStatus() {
        data.invalidate("pkg-status:" + this.header.id)
    }

    savePkgAsync() {
        if (this.header.blobCurrent) return Promise.resolve();
        this.savingNow++;
        this.updateStatus();
        return workspace.saveToCloudAsync(this.header)
            .then(() => {
                this.savingNow--;
                this.updateStatus();
                if (!this.header.blobCurrent)
                    this.scheduleSave();
            })
    }

    private scheduleSave() {
        if (this.saveScheduled) return
        this.saveScheduled = true;
        setTimeout(() => {
            this.saveScheduled = false;
            this.savePkgAsync().done();
        }, 5000)
    }

    saveFilesAsync() {
        if (!this.header) return Promise.resolve();

        let cfgFile = this.files[yelm.configName]
        if (cfgFile) {
            try {
                let cfg = <yelm.PackageConfig>JSON.parse(cfgFile.content)
                this.header.name = cfg.name
            } catch (e) {
            }
        }
        return workspace.saveAsync(this.header, {
            files: Util.mapStringMap(this.files, (k, f) => f.content)
        })
            .then(() => this.scheduleSave())
    }

    sortedFiles() {
        return Util.values(this.files)
    }

    getMainFile() {
        return this.sortedFiles().filter(f => f.getExtension() == "ts")[0] || this.sortedFiles()[0]
    }

    pkgAndDeps(): EditorPackage[] {
        return Util.values((<yelm.MainPackage>this.yelmPkg.parent).deps).map(getEditorPkg)
    }

    lookupFile(name: string) {
        return Util.concat(this.pkgAndDeps().map(e => Util.values(e.files).filter(f => f.getName() == name)))[0]
    }
}

class Host
    implements yelm.Host {

    readFileAsync(module: yelm.Package, filename: string): Promise<string> {
        let epkg = getEditorPkg(module)
        let file = epkg.files[filename]
        return Promise.resolve(file ? file.content : null)
    }

    writeFileAsync(module: yelm.Package, filename: string, contents: string): Promise<void> {
        if (filename == yelm.configName)
            return Promise.resolve(); // ignore config writes
        throw Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync() {
        return Promise.resolve(require("../../../generated/hexinfo.js"))
    }

    downloadPackageAsync(pkg: yelm.Package) {
        let proto = pkg.verProtocol()
        let epkg = getEditorPkg(pkg)

        if (proto == "pub")
            // make sure it sits in cache
            return workspace.getScriptFilesAsync(pkg.verArgument())
                .then(files => epkg.setFiles(files))
        else if (proto == "workspace") {
            return workspace.getTextAsync(pkg.verArgument())
                .then(scr => epkg.setFiles(scr.files))
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: yelm.Package) {
        return data.getAsync("cloud:" + yelm.pkgPrefix + pkg.id).then(r => {
            let id = (r || {})["scriptid"]
            if (!id)
                Util.userError(lf("cannot resolve package {0}", pkg.id))
            return id
        })
    }

}

var theHost = new Host();
export var mainPkg = new yelm.MainPackage(theHost);

export function getEditorPkg(p: yelm.Package) {
    let r: EditorPackage = (p as any)._editorPkg
    if (r) return r
    return ((p as any)._editorPkg = new EditorPackage(p))
}

export function allEditorPkgs() {
    return Util.values(mainPkg.deps).map(getEditorPkg)
}

export function notifySyncDone(updated: Util.StringMap<number>) {
    let newOnes = Util.values(mainPkg.deps).filter(d => d.verProtocol() == "workspace" && updated.hasOwnProperty(d.verArgument()))
    if (newOnes.length > 0) {
        getEditorPkg(mainPkg).onupdate()
    }

}

export function loadPkgAsync(id: string) {
    mainPkg = new yelm.MainPackage(theHost)
    mainPkg._verspec = "workspace:" + id

    return theHost.downloadPackageAsync(mainPkg)
        .then(() => theHost.readFileAsync(mainPkg, yelm.configName))
        .then(str => {
            data.invalidate("open:")
            if (!str) return Promise.resolve()
            return mainPkg.installAllAsync()
                .catch(e => {
                    core.errorNotification(lf("Cannot load package: {0}", e.message))
                })
        })
}

/*
    open:<pkgName>/<filename> - one file
*/
data.mountVirtualApi("open", {
    isSync: p => true,
    getSync: p => {
        let f = getEditorPkg(mainPkg).lookupFile(data.stripProtocol(p))
        if (f) return f.content
        return null
    },
    getAsync: null
})

/*
    open-status:<pkgName>/<filename> - 
*/
data.mountVirtualApi("open-status", {
    isSync: p => true,
    getSync: p => {
        p = data.stripProtocol(p)
        let f = getEditorPkg(mainPkg).lookupFile(p)
        if (f) {
            if (f.inSyncWithEditor && f.inSyncWithDisk)
                return "saved"
            else
                return "unsaved"
        }
        return null
    },
    getAsync: null
})

// pkg-status:<guid>
data.mountVirtualApi("pkg-status", {
    isSync: p => true,
    getSync: p => {
        p = data.stripProtocol(p)
        let ep = allEditorPkgs().filter(pkg => pkg.header && pkg.header.id == p)[0]
        if (ep)
            return ep.savingNow ? "saving" : ""
        return ""
    },
    getAsync: null
})

