import * as React from "react";
import * as workspace from "./workspace";
import * as core from "./core";

export type Action = () => void;
export type AnyComponent = Component<any, any>;

interface CacheEntry {
    path: string;
    data: any;
    lastRefresh: number;
    queued: boolean;
    callbackOnce: Action[];
    components: AnyComponent[];
    api: VirtualApi;
}

var virtualApis: Util.StringMap<VirtualApi> = {}

mountVirtualApi("cloud", {
    isSync: p => false,
    getSync: p => null,
    getAsync: p => Cloud.privateGetAsync(stripProtocol(p)),
    expirationTime: p => 60 * 1000,
})

var cachedData: Util.StringMap<CacheEntry> = {};

function subscribe(component: AnyComponent, path: string) {
    let e = lookup(path)
    let lst = e.components
    if (lst.indexOf(component) < 0) {
        lst.push(component)
        component.subscriptions.push(e)
    }
}

function unsubscribe(component: AnyComponent) {
    let lst = component.subscriptions
    if (lst.length == 0) return
    component.subscriptions = []
    lst.forEach(ce => {
        let idx = ce.components.indexOf(component)
        if (idx >= 0) ce.components.splice(idx, 1)
    })
}

function expired(ce: CacheEntry) {
    if (!ce.api.expirationTime)
        return ce.data != null;
    return ce.data == null || (Date.now() - ce.lastRefresh) > ce.api.expirationTime(ce.path)
}

function shouldCache(ce: CacheEntry) {
    if (!ce.data) return false
    return /^cloud:me\/settings/.test(ce.path)
}

function loadCache() {
    JSON.parse(window.localStorage["apiCache2"] || "[]").forEach((e: any) => {
        let ce = lookup(e.path)
        ce.data = e.data
    })
}

function saveCache() {
    let obj = Util.values(cachedData).filter(e => shouldCache(e)).map(e => {
        return {
            path: e.path,
            data: e.data
        }
    })
    window.localStorage["apiCache2"] = JSON.stringify(obj)
}

function matches(ce: CacheEntry, prefix: string) {
    return ce.path.slice(0, prefix.length) == prefix;
}

function notify(ce: CacheEntry) {
    if (shouldCache(ce)) saveCache();

    let lst = ce.callbackOnce
    if (lst.length > 0) {
        ce.callbackOnce = []
        Util.nextTick(() => lst.forEach(f => f()))
    }

    if (ce.components.length > 0)
        Util.nextTick(() => ce.components.forEach(c => c.forceUpdate()))
}

function getVirtualApi(path: string) {
    let m = /^([\w\-]+):/.exec(path)
    if (!m || !virtualApis[m[1]])
        Util.oops("bad data protocol: " + path)
    return virtualApis[m[1]]
}

function queue(ce: CacheEntry) {
    if (ce.queued) return
    ce.queued = true

    let final = (res: any) => {
        ce.data = res
        ce.lastRefresh = Date.now()
        ce.queued = false
        notify(ce)
    }

    if (ce.api.isSync(ce.path))
        final(ce.api.getSync(ce.path))
    else
        ce.api.getAsync(ce.path).done(final)
}

function lookup(path: string) {
    if (!cachedData.hasOwnProperty(path))
        cachedData[path] = {
            path: path,
            data: null,
            lastRefresh: 0,
            queued: false,
            callbackOnce: [],
            components: [],
            api: getVirtualApi(path)
        }
    return cachedData[path]
}

function getCached(component: AnyComponent, path: string) {
    subscribe(component, path)
    let r = lookup(path)
    if (r.api.isSync(r.path))
        return r.api.getSync(r.path)
    if (expired(r))
        queue(r)
    return r.data
}

//
// Public interface
//

export interface VirtualApi {
    getAsync(path: string): Promise<any>;
    getSync(path: string): any;
    isSync(path: string): boolean;
    expirationTime?(path: string): number; // in milliseconds
}

export function mountVirtualApi(protocol: string, handler: VirtualApi) {
    Util.assert(!virtualApis[protocol])
    virtualApis[protocol] = handler
}

export function stripProtocol(path: string) {
    let m = /^([\w\-]+):(.*)/.exec(path)
    if (m) return m[2]
    else Util.oops("protocol missing in: " + path)
    return path
}

export function invalidate(prefix: string) {
    Util.values(cachedData).forEach(ce => {
        if (matches(ce, prefix)) {
            ce.lastRefresh = 0;
            if (ce.components.length > 0)
                queue(lookup(ce.path))
        }
    })
}

export function getAsync(path: string) {
    let ce = lookup(path)

    if (ce.api.isSync(ce.path))
        return Promise.resolve(ce.api.getSync(ce.path))

    if (!expired(ce))
        return Promise.resolve(ce.data)

    return new Promise((resolve, reject) => {
        ce.callbackOnce.push(() => {
            resolve(ce.data)
        })
        queue(ce)
    })
}

export class Component<T, S> extends React.Component<T, S> {
    subscriptions: CacheEntry[] = [];
    renderCoreOk = false;

    constructor(props: T) {
        super(props);
    }

    getData(path: string) {
        if (!this.renderCoreOk)
            Util.oops("Override renderCore() not render()")
        return getCached(this, path)
    }

    componentWillUnmount(): void {
        unsubscribe(this)
    }

    child(selector: string) {
        return core.findChild(this, selector)
    }

    renderCore(): JSX.Element {
        return null;
    }

    render() {
        unsubscribe(this)
        this.renderCoreOk = true;
        return this.renderCore();
    }
}


loadCache();
