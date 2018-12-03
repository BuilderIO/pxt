/* tslint:disable:no-jquery-raw-elements TODO(tslint): get rid of jquery html() calls */
/// <reference path="../localtypings/pxtarget.d.ts"/>
/// <reference path="../localtypings/pxtrenderer.d.ts" />

namespace pxt.docs {
    export interface ClientRenderOptions {
        snippetClass?: string;
        signatureClass?: string;
        blocksClass?: string;
        blocksXmlClass?: string;
        projectClass?: string;
        blocksAspectRatio?: number;
        simulatorClass?: string;
        linksClass?: string;
        namespacesClass?: string;
        codeCardClass?: string;
        tutorial?: boolean;
        snippetReplaceParent?: boolean;
        simulator?: boolean;
        hex?: boolean;
        hexName?: string;
        pxtUrl?: string;
        packageClass?: string;
        package?: string;
        showEdit?: boolean;
        showJavaScript?: boolean; // default is to show blocks first
        split?: boolean; // split in multiple divs if too big
    }

    export interface WidgetOptions {
        showEdit?: boolean;
        showJs?: boolean;
        hideGutter?: boolean;
        run?: boolean;
        hexname?: string;
        hex?: string;
    }

    function appendBlocks($parent: JQuery, $svg: JQuery) {
        $parent.append($('<div class="ui content blocks"/>').append($svg));
    }

    function appendJs($parent: JQuery, $js: JQuery, woptions: WidgetOptions) {
        $parent.append($('<div class="ui content js"/>').append($js));
        // todo
        //if (typeof hljs !== "undefined")
        //    $js.find('code.highlight').each(function (i, block) {
        //        hljs.highlightBlock(block);
        //    });
    }

    function fillWithWidget(
        options: ClientRenderOptions,
        $container: JQuery,
        $js: JQuery,
        $svg: JQuery,
        res: pxt.runner.RenderBlocksResponseMessage,
        woptions: WidgetOptions = {}
    ) {
        let $h = $('<div class="ui bottom attached tabular icon small compact menu hideprint">'
            + ' <div class="right icon menu"></div></div>');
        let $c = $('<div class="ui top attached segment codewidget"></div>');
        let $menu = $h.find('.right.menu');

        // TODO!
        if (res && res.editUrl) {
            const $editBtn = $(`<a class="item" role="button" tabindex="0" aria-label="${lf("edit")}"><i role="presentation" aria-hidden="true" class="edit icon"></i></a>`)
                .attr("href", res.editUrl);
            $menu.append($editBtn);
        }
        /* TODO
        if (woptions.showEdit && !theme.hideDocsEdit) { // edit button
            const $editBtn = $(`<a class="item" role="button" tabindex="0" aria-label="${lf("edit")}"><i role="presentation" aria-hidden="true" class="edit icon"></i></a>`).click(() => {
                decompileResult.package.compressToFileAsync(options.showJavaScript ? pxt.JAVASCRIPT_PROJECT_NAME : pxt.BLOCKS_PROJECT_NAME)
                    .done(buf => window.open(`${getEditUrl(options)}/#project:${ts.pxtc.encodeBase64(ts.pxtc.Util.uint8ArrayToString(buf))}`, 'pxt'))
            })
            $menu.append($editBtn);
        }
        */

        if (options.showJavaScript || !$svg) {
            // blocks
            $c.append($js);

            // js menu
            if ($svg) {
                const $svgBtn = $(`<a class="item blocks" role="button" tabindex="0" aria-label="${lf("Blocks")}"><i role="presentation" aria-hidden="true" class="puzzle icon"></i></a>`).click(() => {
                    if ($c.find('.blocks')[0])
                        $c.find('.blocks').remove();
                    else {
                        if ($js) appendBlocks($js.parent(), $svg);
                        else appendBlocks($c, $svg);
                    }
                })
                $menu.append($svgBtn);
            }
        } else {
            // blocks
            $c.append($svg);

            // js menu
            if (woptions.showJs) {
                appendJs($c, $js, woptions);
            } else {
                const $jsBtn = $(`<a class="item js" role="button" tabindex="0" aria-label="${lf("JavaScript")}"><i role="presentation" aria-hidden="true" class="align left icon"></i></a>`).click(() => {
                    if ($c.find('.js')[0])
                        $c.find('.js').remove();
                    else {
                        if ($svg) appendJs($svg.parent(), $js, woptions);
                        else appendJs($c, $js, woptions);
                    }
                })
                $menu.append($jsBtn);
            }
        }

        // runner menu
        // TODO
        /*
        if (woptions.run && !theme.hideDocsSimulator) {
            let $runBtn = $(`<a class="item" role="button" tabindex="0" aria-label="${lf("run")}"><i role="presentation" aria-hidden="true" class="play icon"></i></a>`).click(() => {
                if ($c.find('.sim')[0])
                    $c.find('.sim').remove(); // remove previous simulators
                else {
                    let padding = '81.97%';
                    if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                    let $embed = $(`<div class="ui card sim"><div class="ui content"><div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${getRunUrl(options) + "#nofooter=1&code=" + encodeURIComponent($js.text())}" allowfullscreen="allowfullscreen" sandbox="allow-popups allow-forms allow-scripts allow-same-origin" frameborder="0"></iframe></div></div></div>`);
                    $c.append($embed);
                }
            })
            $menu.append($runBtn);
        }
        */

        // TODO
        /*
        if (woptions.hexname && woptions.hex) {
            let $hexBtn = $(`<a class="item" role="button" tabindex="0" aria-label="${lf("download")}"><i role="presentation" aria-hidden="true" class="download icon"></i></a>`).click(() => {
                pxt.BrowserUtils.browserDownloadBinText(woptions.hex, woptions.hexname, pxt.appTarget.compile.hexMimeType);
            })
            $menu.append($hexBtn);
        }
        */

        let r = [$c];
        // don't add menu if empty
        if ($menu.children().length) r.push($h);

        // inject container
        $container.replaceWith(r as any);
    }

    const IFRAME_RENDERER_ID = "makecoderenderer"
    function createRenderer(): HTMLIFrameElement {
        let f = document.getElementById(IFRAME_RENDERER_ID) as HTMLIFrameElement;
        if (f) {
            const ready = !!f.getAttribute("data-ready");
            if (ready) return f;
            else return undefined;
        }

        console.debug(`loading rendering iframe`);
        window.addEventListener("message", handleRendererMessage, false);
        f = document.createElement("iframe") as HTMLIFrameElement;
        f.id = IFRAME_RENDERER_ID;
        f.style.position = "absolute";
        f.style.left = "0";
        f.style.bottom = "0";
        f.style.width = "1px";
        f.style.height = "1px";
        // TODO
        f.src = "/---docs?render=1"
        document.body.appendChild(f);

        return undefined;
    }

    interface RenderJob {
        el: JQuery;
        source: string;
        pending: boolean;
        options: blocks.BlocksRenderOptions;
        render: (container: JQuery, r: pxt.runner.RenderBlocksResponseMessage) => void;
    }
    const renderQueue: pxt.Map<RenderJob> = {};
    function renderJob(job: RenderJob) {
        let id = job.el.attr("id");
        console.debug(`queue job ${id}`);
        renderQueue[id] = job;
        const f = createRenderer();
        if (f) {
            f.contentWindow.postMessage({
                type: "renderblocks",
                id: id,
                code: job.source,
                options: options
            }, "*");
        } else {
            // wait for iframe
            console.debug(`job ${id} pending`);
            job.pending = true;
        }
    }
    function consumePendingQueue() {
        console.debug('consume rendering queue');
        let f = document.getElementById(IFRAME_RENDERER_ID) as HTMLIFrameElement;
        f.setAttribute("data-ready", "true");
        Object.keys(renderQueue).forEach(id => {
            const job = renderQueue[id];
            renderJob(job); // queue again which replaces the job in queue
        })
    }
    function handleRendererMessage(ev: MessageEvent) {
        const msg = ev.data;
        if (msg.source != "makecode") return;
        switch (msg.type) {
            case "renderready":
                consumePendingQueue();
                break;
            case "renderblocks":
                const id = msg.id;   // this is the id you sent
                if (!id) return;
                const job = renderQueue[id];
                delete renderQueue[id];
                if (!job)
                    console.debug(`job ${id} not found`);
                else {
                    console.debug(`job ${id} rendered`);
                    job.render(job.el, msg as pxt.runner.RenderBlocksResponseMessage);
                    job.el.removeClass("lang-shadow");
                    // replace text with svg
                    //const img = document.createElement("img");
                    //img.src = msg.uri;
                    //img.width = msg.width;
                    //img.height = msg.height;
                    //const snippet = document.getElementById(id)
                    //snippet.parentNode.insertBefore(img, snippet)
                    //snippet.parentNode.removeChild(snippet);
                }
                // all done?
                consumeRenderQueue();
                break;
        }
    }

    function consumeRenderQueue(): void {
        // nothing to do
    }

    function renderNextSnippet(cls: string,
        render: (container: JQuery, r: pxt.runner.RenderBlocksResponseMessage) => void,
        options?: pxt.blocks.BlocksRenderOptions): void {
        if (!cls) return;

        const $els = $("." + cls);
        $els.each(function () {
            const $el = $(this);
            options.splitSvg = true;

            let id = $el.attr("id");
            if (!id) $el.attr("id", id = Math.random().toString());

            const source = $el.text();
            renderJob({ el: $el, pending: false, source: source, options, render });
            $el.addClass("lang-shadow");
            $el.removeClass(cls);
        })
    }

    function renderSnippets(options: ClientRenderOptions): void {
        if (options.tutorial) {
            // don't render chrome for tutorials
            renderNextSnippet(options.snippetClass, (c, r) => {
                const s = r.svg;
                if (options.snippetReplaceParent) c = c.parent();
                const segment = $('<div class="ui segment codewidget"/>').append(s);
                c.replaceWith(segment);
            }, { package: options.package, snippetMode: false, aspectRatio: options.blocksAspectRatio });
        }

        let snippetCount = 0;
        renderNextSnippet(options.snippetClass, (c, r) => {
            const s = r.svg ? $(r.svg) : undefined;
            const js = $('<code class="lang-typescript highlight"/>').text(c.text().trim());
            if (options.snippetReplaceParent) c = c.parent();
            const compiled = r.compileJS && r.compileJS.success;
            const hex = compiled && r.compileJS.outfiles[r.compileJS.outputName];
            // TODO
            const hexname = r.compileJS.outputName; // `${appTarget.nickname || appTarget.id}-${options.hexName || ''}-${snippetCount++}${r.compileJS.outputName.slice('binary'.length)}`;
            fillWithWidget(options, c, js, s, r, {
                showEdit: options.showEdit,
                run: options.simulator && compiled,
                hexname: hexname,
                hex: hex,
            });
        }, { package: options.package, aspectRatio: options.blocksAspectRatio });
    }

    function renderSignatures(options: ClientRenderOptions): void {
        /* TODO
        renderNextSnippet(options.signatureClass, (c, r) => {
            let cjs = r.compileJS;
            if (!cjs) return;
            let file = r.compileJS.ast.getSourceFile("main.ts");
            let info = decompileCallInfo(file.statements[0]);
            if (!info || !r.apiInfo) return;
            const symbolInfo = r.apiInfo.byQName[info.qName];
            if (!symbolInfo) return;
            let block = Blockly.Blocks[symbolInfo.attributes.blockId];
            let xml = block && block.codeCard ? block.codeCard.blocksXml : undefined;

            const s = xml ? $(pxt.blocks.render(xml)) : r.compileBlocks && r.compileBlocks.success ? $(r.blocksSvg) : undefined;
            let sig = info.decl.getText().replace(/^export/, '');
            sig = sig.slice(0, sig.indexOf('{')).trim() + ';';
            let js = $('<code class="lang-typescript highlight"/>').text(sig);
            if (options.snippetReplaceParent) c = c.parent();
            fillWithWidget(options, c, js, s, r, { showJs: true, hideGutter: true });
        }, { package: options.package, snippetMode: true, aspectRatio: options.blocksAspectRatio });
        */
    }

    function renderBlocks(options: ClientRenderOptions): void {
        renderNextSnippet(options.blocksClass, (c, r) => {
            const s = r.svg;
            if (options.snippetReplaceParent) c = c.parent();
            const segment = $('<div class="ui segment codewidget"/>').append(s);
            c.replaceWith(segment);
        }, { package: options.package, snippetMode: true, aspectRatio: options.blocksAspectRatio });
    }

    function renderBlocksXml(opts: ClientRenderOptions): void {
        /* TODO
        if (!opts.blocksXmlClass) return;
        const cls = opts.blocksXmlClass;
        function renderNextXmlAsync(cls: string,
            render: (container: JQuery, r: pxt.runner.RenderBlocksResponseMessage) => void,
            options?: pxt.blocks.BlocksRenderOptions): Promise<void> {
            let $el = $("." + cls).first();
            if (!$el[0]) return Promise.resolve();

            if (!options.emPixels) options.emPixels = 18;
            options.splitSvg = true;
            return pxt.runner.compileBlocksAsync($el.text(), options)
                .then((r) => {
                    try {
                        render($el, r);
                    } catch (e) {
                        pxt.reportException(e)
                        $el.append($('<div/>').addClass("ui segment warning").text(e.message));
                    }
                    $el.removeClass(cls);
                    return Promise.delay(1, renderNextXmlAsync(cls, render, options));
                })
        }

        return renderNextXmlAsync(cls, (c, r) => {
            const s = r.svg;
            if (opts.snippetReplaceParent) c = c.parent();
            const segment = $('<div class="ui segment codewidget"/>').append(s);
            c.replaceWith(segment);
        }, { package: opts.package, snippetMode: true, aspectRatio: opts.blocksAspectRatio });
        */
    }

    function renderNamespaces(options: ClientRenderOptions): void {
        /* TODO
        if (pxt.appTarget.id == "core") return;
        return pxt.runner.decompileToBlocksAsync('', options)
            .then((r) => {
                let res: pxt.Map<string> = {};
                const info = r.compileBlocks.blocksInfo;
                info.blocks.forEach(fn => {
                    const ns = (fn.attributes.blockNamespace || fn.namespace).split('.')[0];
                    if (!res[ns]) {
                        const nsn = info.apis.byQName[ns];
                        if (nsn && nsn.attributes.color)
                            res[ns] = nsn.attributes.color;
                    }
                });
                let nsStyleBuffer = '';
                Object.keys(res).forEach(ns => {
                    const color = res[ns] || '#dddddd';
                    nsStyleBuffer += `
                        span.docs.${ns.toLowerCase()} {
                            background-color: ${color} !important;
                            border-color: ${pxt.toolbox.fadeColor(color, 0.1, false)} !important;
                        }
                    `;
                })
                return nsStyleBuffer;
            })
            .then((nsStyleBuffer) => {
                Object.keys(pxt.toolbox.blockColors).forEach((ns) => {
                    const color = pxt.toolbox.getNamespaceColor(ns);
                    nsStyleBuffer += `
                        span.docs.${ns.toLowerCase()} {
                            background-color: ${color} !important;
                            border-color: ${pxt.toolbox.fadeColor(color, 0.1, false)} !important;
                        }
                    `;
                })
                return nsStyleBuffer;
            })
            .then((nsStyleBuffer) => {
                // Inject css
                let nsStyle = document.createElement('style');
                nsStyle.id = "namespaceColors";
                nsStyle.type = 'text/css';
                let head = document.head || document.getElementsByTagName('head')[0];
                head.appendChild(nsStyle);
                nsStyle.appendChild(document.createTextNode(nsStyleBuffer));
            });
        */
    }

    function renderInlineBlocks(options: pxt.blocks.BlocksRenderOptions): void {
        /* TODO
        options = ts.pxtc.Util.clone(options);
        options.emPixels = 18;
        options.snippetMode = true;

        const $els = $(`:not(pre) > code`);
        let i = 0;
        function renderNextAsync(): Promise<void> {
            if (i >= $els.length) return Promise.resolve();
            const $el = $($els[i++]);
            const text = $el.text();
            const mbtn = /^(\|+)([^\|]+)\|+$/.exec(text);
            if (mbtn) {
                const mtxt = /^(([^\:\.]*?)[\:\.])?(.*)$/.exec(mbtn[2]);
                const ns = mtxt[2] ? mtxt[2].trim().toLowerCase() : '';
                const lev = mbtn[1].length == 1 ? `docs inlinebutton ${ns}` : `docs inlineblock ${ns}`;
                const txt = mtxt[3].trim();
                $el.replaceWith($(`<span class="${lev}"/>`).text(U.rlf(txt)));
                return renderNextAsync();
            }

            const m = /^\[([^\]]+)\]$/.exec(text);
            if (!m) return renderNextAsync();

            const code = m[1];
            return pxt.runner.decompileToBlocksAsync(code, options)
                .then(r => {
                    if (r.blocksSvg) {
                        let $newel = $('<span class="block"/>').append(r.blocksSvg);
                        const file = r.compileJS.ast.getSourceFile("main.ts");
                        const stmt = file.statements[0];
                        const info = decompileCallInfo(stmt);
                        if (info && r.apiInfo) {
                            const symbolInfo = r.apiInfo.byQName[info.qName];
                            if (symbolInfo && symbolInfo.attributes.help) {
                                $newel = $(`<a class="ui link"/>`).attr("href", `/reference/${symbolInfo.attributes.help}`).append($newel);
                            }
                        }
                        $el.replaceWith($newel);
                    }
                    return Promise.delay(1, renderNextAsync());
                });
        }

        return renderNextAsync();
        */
    }

    function renderProject(options: ClientRenderOptions): void {
        /* TODO
        if (!options.projectClass) return;

        function render(): Promise<void> {
            let $el = $("." + options.projectClass).first();
            let e = $el[0];
            if (!e) return Promise.resolve();

            $el.removeClass(options.projectClass);

            let id = pxt.Cloud.parseScriptId(e.innerText);
            if (id) {
                if (options.snippetReplaceParent) {
                    e = e.parentElement;
                    // create a new div to host the rendered code
                    let d = document.createElement("div");
                    e.parentElement.insertBefore(d, e);
                    e.parentElement.removeChild(e);

                    e = d;
                }
                return pxt.runner.renderProjectAsync(e, id)
                    .then(() => render());
            }
            else return render();
        }

        return render();
        */
    }

    function renderLinks(options: ClientRenderOptions, cls: string, replaceParent: boolean, ns: boolean): void {
        /* TODO
        renderNextSnippet(cls, (c, r) => {
            const cjs = r.compileJS;
            if (!cjs) return;
            const file = r.compileJS.ast.getSourceFile("main.ts");
            const stmts = file.statements.slice(0);
            const ul = $('<div />').addClass('ui cards');
            ul.attr("role", "listbox");
            const addItem = (card: pxt.CodeCard) => {
                if (!card) return;
                const mC = /^\/(v\d+)/.exec(card.url);
                const mP = /^\/(v\d+)/.exec(window.location.pathname);
                const inEditor = /#doc/i.test(window.location.href);
                if (card.url && !mC && mP && !inEditor) card.url = `/${mP[1]}/${card.url}`;
                ul.append(pxt.docs.codeCard.render(card, { hideHeader: true, shortName: true }));
            }
            stmts.forEach(stmt => {
                let info = decompileCallInfo(stmt);
                if (info && r.apiInfo && r.apiInfo.byQName[info.qName]) {
                    const attributes = r.apiInfo.byQName[info.qName].attributes;
                    let block = Blockly.Blocks[attributes.blockId];
                    if (ns) {
                        let ii = r.compileBlocks.blocksInfo.apis.byQName[info.qName];
                        let nsi = r.compileBlocks.blocksInfo.apis.byQName[ii.namespace];
                        addItem({
                            name: nsi.attributes.blockNamespace || nsi.name,
                            url: nsi.attributes.help || ("reference/" + (nsi.attributes.blockNamespace || nsi.name).toLowerCase()),
                            description: nsi.attributes.jsDoc,
                            blocksXml: block && block.codeCard
                                ? block.codeCard.blocksXml
                                : attributes.blockId
                                    ? `<xml xmlns="http://www.w3.org/1999/xhtml"><block type="${attributes.blockId}"></block></xml>`
                                    : undefined
                        })
                    } else if (block) {
                        let card = U.clone(block.codeCard) as pxt.CodeCard;
                        if (card) {
                            addItem(card);
                        }
                    } else {
                        // no block available here
                        addItem({
                            name: info.qName,
                            description: attributes.jsDoc,
                            url: attributes.help || undefined
                        })
                    }
                } else
                    switch (stmt.kind) {
                        case ts.SyntaxKind.ExpressionStatement:
                            let es = stmt as ts.ExpressionStatement;
                            switch (es.expression.kind) {
                                case ts.SyntaxKind.TrueKeyword:
                                case ts.SyntaxKind.FalseKeyword:
                                    addItem({
                                        name: "Boolean",
                                        url: "blocks/logic/boolean",
                                        description: lf("True or false values"),
                                        blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></xml>'
                                    });
                                    break;
                                default:
                                    pxt.debug(`card expr kind: ${es.expression.kind}`);
                                    break;
                            }
                            break;
                        case ts.SyntaxKind.IfStatement:
                            addItem({
                                name: ns ? "Logic" : "if",
                                url: "blocks/logic" + (ns ? "" : "/if"),
                                description: ns ? lf("Logic operators and constants") : lf("Conditional statement"),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_if"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.WhileStatement:
                            addItem({
                                name: ns ? "Loops" : "while",
                                url: "blocks/loops" + (ns ? "" : "/while"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code while a condition is true."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="device_while"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ForOfStatement:
                            addItem({
                                name: ns ? "Loops" : "for of",
                                url: "blocks/loops" + (ns ? "" : "/for-of"),
                                description: ns ? lf("Loops and repetition") : lf("Repeat code for each item in a list."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_for_of"></block></xml>'
                            });
                            break;
                        case ts.SyntaxKind.ForStatement:
                            let fs = stmt as ts.ForStatement;
                            // look for the 'repeat' loop style signature in the condition expression, explicitly: (let i = 0; i < X; i++)
                            // for loops will have the '<=' conditional.
                            let forloop = true;
                            if (fs.condition.getChildCount() == 3) {
                                forloop = !(fs.condition.getChildAt(0).getText() == "0" ||
                                    fs.condition.getChildAt(1).kind == ts.SyntaxKind.LessThanToken);
                            }
                            if (forloop) {
                                addItem({
                                    name: ns ? "Loops" : "for",
                                    url: "blocks/loops" + (ns ? "" : "/for"),
                                    description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times using an index."),
                                    blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_simple_for"></block></xml>'
                                });
                            } else {
                                addItem({
                                    name: ns ? "Loops" : "repeat",
                                    url: "blocks/loops" + (ns ? "" : "/repeat"),
                                    description: ns ? lf("Loops and repetition") : lf("Repeat code for a given number of times."),
                                    blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="controls_repeat_ext"></block></xml>'
                                });
                            }
                            break;
                        case ts.SyntaxKind.VariableStatement:
                            addItem({
                                name: ns ? "Variables" : "variable declaration",
                                url: "blocks/variables" + (ns ? "" : "/assign"),
                                description: ns ? lf("Variables") : lf("Assign a value to a named variable."),
                                blocksXml: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="variables_set"></block></xml>'
                            });
                            break;
                        default:
                            pxt.debug(`card kind: ${stmt.kind}`)
                    }
            })

            if (replaceParent) c = c.parent();
            c.replaceWith(ul)
        }, { package: options.package, aspectRatio: options.blocksAspectRatio })
        */
    }

    function fillCodeCard(c: JQuery, cards: pxt.CodeCard[], options: pxt.docs.codeCard.CodeCardRenderOptions): void {
        if (!cards || cards.length == 0) return;

        if (cards.length == 0) {
            let cc = pxt.docs.codeCard.render(cards[0], options)
            c.replaceWith(cc);
        } else {
            let cd = document.createElement("div")
            cd.className = "ui cards";
            cd.setAttribute("role", "listbox")
            cards.forEach(card => {
                // patch card url with version if necessary, we don't do this in the editor because that goes through the backend and passes the targetVersion then
                const mC = /^\/(v\d+)/.exec(card.url);
                const mP = /^\/(v\d+)/.exec(window.location.pathname);
                const inEditor = /#doc/i.test(window.location.href);
                if (card.url && !mC && mP && !inEditor) card.url = `/${mP[1]}${card.url}`;
                const cardEl = pxt.docs.codeCard.render(card, options);
                cd.appendChild(cardEl)
                // automitcally display package icon for approved packages
                if (card.cardType == "package") {
                    // TODO
                    /*
                    // update card info
                    const repoId = pxt.github.parseRepoId((card.url || "").replace(/^\/pkg\//, ''));
                    card.imageUrl = pxt.github.mkRepoIconUrl(repoId);
                    */
                    // inject
                    cd.insertBefore(pxt.docs.codeCard.render(card, options), cardEl);
                }
            });
            c.replaceWith(cd);
        }
    }

    function renderCodeCard(cls: string, options: ClientRenderOptions): void {
        if (!cls) return;

        const $els = $("." + cls);
        $els.each(function () {
            let $el = $(this);
            $el.removeClass(cls);
            let cards: pxt.CodeCard[];
            try {
                const source = $el.text();
                let js: any = JSON.parse(source);
                if (!Array.isArray(js)) js = [js];
                cards = js as pxt.CodeCard[];
            } catch (e) {
                pxt.reportException(e);
                $el.append($('<div/>').addClass("ui segment warning").text(e.messageText));
            }
            if (options.snippetReplaceParent) $el = $el.parent();
            fillCodeCard($el, cards, { hideHeader: true });
        })
    }

    function mergeConfig(options: ClientRenderOptions) {
        // additional config options
        if (!options.packageClass) return;
        $('.' + options.packageClass).each((i, c) => {
            let $c = $(c);
            let name = $c.text().split('\n').map(s => s.replace(/\s*/g, '')).filter(s => !!s).join(',');
            options.package = options.package ? `${options.package},${name}` : name;
            if (options.snippetReplaceParent) $c = $c.parent();
            $c.remove();
        });
        $('.lang-config').each((i, c) => {
            let $c = $(c);
            if (options.snippetReplaceParent) $c = $c.parent();
            $c.remove();
        })
    }

    function renderTypeScript(options?: ClientRenderOptions) {
        const woptions: WidgetOptions = {
            showEdit: !!options.showEdit,
            run: !!options.simulator
        }

        function render(e: Node, ignored: boolean) {
            // TODO
            //if (typeof hljs !== "undefined") {
            //    $(e).text($(e).text().replace(/^\s*\r?\n/, ''))
            //    hljs.highlightBlock(e)
            //}
            const opts = ts.pxtc.Util.clone(woptions);
            if (ignored) {
                opts.run = false;
                opts.showEdit = false;
            }
            fillWithWidget(options, $(e).parent(), $(e), undefined, undefined, opts);
        }

        $('code.lang-typescript').each((i, e) => {
            render(e, false);
            $(e).removeClass('lang-typescript');
        });
        $('code.lang-typescript-ignore').each((i, e) => {
            $(e).removeClass('lang-typescript-ignore');
            $(e).addClass('lang-typescript');
            render(e, true);
            $(e).removeClass('lang-typescript');
        });
        $('code.lang-typescript-invalid').each((i, e) => {
            $(e).removeClass('lang-typescript-invalid');
            $(e).addClass('lang-typescript');
            render(e, true);
            $(e).removeClass('lang-typescript');
            $(e).parent('div').addClass('invalid');
            $(e).parent('div').prepend($("<i>", { "class": "icon ban" }));
            $(e).addClass('invalid');
        });
        $('code.lang-typescript-valid').each((i, e) => {
            $(e).removeClass('lang-typescript-valid');
            $(e).addClass('lang-typescript');
            render(e, true);
            $(e).removeClass('lang-typescript');
            $(e).parent('div').addClass('valid');
            $(e).parent('div').prepend($("<i>", { "class": "icon check" }));
            $(e).addClass('valid');
        });
    }

    export function render(options?: ClientRenderOptions): void {
        pxt.analytics.enable();
        if (!options) options = {}
        if (options.pxtUrl) options.pxtUrl = options.pxtUrl.replace(/\/$/, '');
        // TODO
        //if (options.showEdit) options.showEdit = !pxt.BrowserUtils.isIFrame();

        mergeConfig(options);
        /* TODO
        if (options.simulatorClass) {
            // simulators
            $('.' + options.simulatorClass).each((i, c) => {
                let $c = $(c);
                let padding = '81.97%';
                if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio) + '%';
                let $sim = $(`<div class="ui centered card"><div class="ui content">
                    <div style="position:relative;height:0;padding-bottom:${padding};overflow:hidden;">
                    <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen="allowfullscreen" frameborder="0" sandbox="allow-popups allow-forms allow-scripts allow-same-origin"></iframe>
                    </div>
                    </div></div>`)
                $sim.find("iframe").attr("src", getRunUrl(options) + "#nofooter=1&code=" + encodeURIComponent($c.text().trim()));
                if (options.snippetReplaceParent) $c = $c.parent();
                $c.replaceWith($sim);
            });
        }
        */

        renderTypeScript(options);
        renderCodeCard(options.codeCardClass, options)
        renderNamespaces(options);
        renderInlineBlocks(options);
        renderLinks(options, options.linksClass, options.snippetReplaceParent, false);
        renderLinks(options, options.namespacesClass, options.snippetReplaceParent, true);
        renderSignatures(options);
        renderSnippets(options);
        renderBlocks(options);
        renderBlocksXml(options);
        renderProject(options);
        consumeRenderQueue();
    }
}