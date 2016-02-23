namespace ts.mbit {

    enum TokenKind {
        None,
        Whitespace,
        Identifier,
        Keyword,
        Operator,
        CommentLine,
        CommentBlock,
        NewLine,
        Literal,
        Tree,       // nested list of tokens; synKind stays what it was
        Block,      // Trees with synKind == OpenBraceToken get turned into Blocks
        EOF
    }

    interface Stmt {
        tokens: Token[];
    }

    interface Token {
        kind: TokenKind;
        text: string;
        pos: number;
        synKind: ts.SyntaxKind;
    }

    interface TreeToken extends Token {
        children: Token[];
        endText?: string; // if it has proper ending token, this is the text of it                
    }

    interface BlockToken extends Token {
        stmts: Stmt[]; // for Block          
    }

    function lookupKind(k: ts.SyntaxKind) {
        for (let o of Object.keys(ts.SyntaxKind)) {
            if ((<any>ts).SyntaxKind[o] === k)
                return o;
        }
        return "?"
    }

    let SK = ts.SyntaxKind;

    function infixOperatorPrecedence(kind: ts.SyntaxKind) {
        switch (kind) {
            case SK.CommaToken:
                return 2;

            case SK.EqualsToken:
            case SK.PlusEqualsToken:
            case SK.MinusEqualsToken:
            case SK.AsteriskEqualsToken:
            case SK.AsteriskAsteriskEqualsToken:
            case SK.SlashEqualsToken:
            case SK.PercentEqualsToken:
            case SK.LessThanLessThanEqualsToken:
            case SK.GreaterThanGreaterThanEqualsToken:
            case SK.GreaterThanGreaterThanGreaterThanEqualsToken:
            case SK.AmpersandEqualsToken:
            case SK.BarEqualsToken:
            case SK.CaretEqualsToken:
                return 5;

            case SK.QuestionToken:
            case SK.ColonToken:
                return 7; // ternary operator

            case SK.BarBarToken:
                return 10;
            case SK.AmpersandAmpersandToken:
                return 20;
            case SK.BarToken:
                return 30;
            case SK.CaretToken:
                return 40;
            case SK.AmpersandToken:
                return 50;
            case SK.EqualsEqualsToken:
            case SK.ExclamationEqualsToken:
            case SK.EqualsEqualsEqualsToken:
            case SK.ExclamationEqualsEqualsToken:
                return 60;
            case SK.LessThanToken:
            case SK.GreaterThanToken:
            case SK.LessThanEqualsToken:
            case SK.GreaterThanEqualsToken:
            case SK.InstanceOfKeyword:
            case SK.InKeyword:
            case SK.AsKeyword:
                return 70;
            case SK.LessThanLessThanToken:
            case SK.GreaterThanGreaterThanToken:
            case SK.GreaterThanGreaterThanGreaterThanToken:
                return 80;
            case SK.PlusToken:
            case SK.MinusToken:
                return 90;
            case SK.AsteriskToken:
            case SK.SlashToken:
            case SK.PercentToken:
                return 100;
            case SK.AsteriskAsteriskToken:
                return 101;
            case SK.DotToken:
                return 120;

            default:
                return 0;
        }
    }

    function getTokKind(kind: ts.SyntaxKind) {
        switch (kind) {
            case SK.EndOfFileToken:
                return TokenKind.EOF;

            case SK.SingleLineCommentTrivia:
                return TokenKind.CommentLine;
            case SK.MultiLineCommentTrivia:
                return TokenKind.CommentBlock;
            case SK.NewLineTrivia:
                return TokenKind.NewLine;
            case SK.WhitespaceTrivia:
                return TokenKind.Whitespace;
            case SK.ShebangTrivia:
            case SK.ConflictMarkerTrivia:
                return TokenKind.CommentBlock;

            case SK.NumericLiteral:
            case SK.StringLiteral:
            case SK.RegularExpressionLiteral:
            case SK.NoSubstitutionTemplateLiteral:
            case SK.TemplateHead:
            case SK.TemplateMiddle:
            case SK.TemplateTail:
                return TokenKind.Literal;

            case SK.Identifier:
                return TokenKind.Identifier;

            default:
                if (kind < SK.Identifier)
                    return TokenKind.Operator;

                return TokenKind.Keyword;
        }

    }

    function tokenize(input: string) {
        let scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, input, msg => {
            let pos = scanner.getTextPos()
            console.log("scanner error", pos, msg.message)
        })

        let tokens: Token[] = []
        let braceBalance = 0
        let templateLevel = -1;
        while (true) {
            let kind = scanner.scan()

            if (kind == SK.CloseBraceToken && braceBalance == templateLevel) {
                templateLevel = -1;
                kind = scanner.reScanTemplateToken()
            }

            if (kind == SK.SlashToken || kind == SK.SlashEqualsToken) {
                let tmp = scanner.reScanSlashToken()
                if (tmp == SK.RegularExpressionLiteral)
                    kind = tmp;
            }

            let tok: Token = {
                kind: getTokKind(kind),
                synKind: kind,
                pos: scanner.getTokenPos(),
                text: scanner.getTokenText(),
            }

            if (kind == SK.OpenBraceToken)
                braceBalance++;

            if (kind == SK.CloseBraceToken) {
                if (--braceBalance < 0)
                    braceBalance = -10000000;
            }

            tokens.push(tok)

            if (kind == SK.TemplateHead || kind == SK.TemplateMiddle) {
                templateLevel = braceBalance;
            }

            if (tok.kind == TokenKind.EOF)
                break;
        }

        // Util.assert(tokens.map(t => t.text).join("") == input)

        return { tokens, braceBalance }
    }

    // Add Tree tokens where needed
    function matchBraces(tokens: Token[]) {
        let braceStack: {
            synKind: ts.SyntaxKind;
            token: TreeToken;
        }[] = []

        let braceTop = () => braceStack[braceStack.length - 1]

        braceStack.push({
            synKind: SK.EndOfFileToken,
            token: {
                children: [],
            } as any,
        })

        let pushClose = (tok: Token, synKind: ts.SyntaxKind) => {
            let token = tok as TreeToken
            token.children = []
            token.kind = TokenKind.Tree
            braceStack.push({ synKind, token })
        }

        for (let i = 0; i < tokens.length; ++i) {
            let token = tokens[i]

            let top = braceStack[braceStack.length - 1]
            top.token.children.push(token)

            switch (token.kind) {
                case TokenKind.Operator:
                    switch (token.synKind) {
                        case SK.OpenBraceToken:
                        case SK.OpenParenToken:
                        case SK.OpenBracketToken:
                            pushClose(token, token.synKind + 1);
                            break;
                        case SK.CloseBraceToken:
                        case SK.CloseParenToken:
                        case SK.CloseBracketToken:
                            top.token.children.pop();
                            while (true) {
                                top = braceStack.pop()
                                if (top.synKind == token.synKind) {
                                    top.token.endText = token.text;
                                    break;
                                }
                                // don't go past brace with other closing parens
                                if (braceStack.length == 0 || top.synKind == SK.CloseBraceToken) {
                                    braceStack.push(top);
                                    break;
                                }
                            }
                            break;
                        default:
                            break;
                    }
                    break;
            }
        }

        return braceStack[0].token.children
    }

    function mkEOF(): Token {
        return {
            kind: TokenKind.EOF,
            synKind: SK.EndOfFileToken,
            pos: 0,
            text: ""
        }
    }

    function delimitStmts(tokens: Token[]): Stmt[] {
        let res: Stmt[] = []
        let i = 0;

        tokens = tokens.concat([mkEOF()])

        while (i < tokens.length - 1) {
            let stmtBeg = i
            skipToStmtEnd();
            Util.assert(i > stmtBeg)
            let toks = tokens.slice(stmtBeg, i)
            toks.forEach(delimitIn)
            res.push({
                tokens: toks
            })
        }

        return res

        function delimitIn(t: Token) {
            if (t.kind == TokenKind.Tree) {
                let tree = t as TreeToken
                if (t.synKind == SK.OpenBraceToken) {
                    let blk = t as BlockToken
                    blk.stmts = delimitStmts(tree.children)
                    delete tree.children
                    blk.kind = TokenKind.Block
                } else {
                    tree.children.forEach(delimitIn)
                }
            }
        }

        function nextNonWs(stopOnNewLine = false) {
            while (true) {
                i++;
                switch (tokens[i].kind) {
                    case TokenKind.Whitespace:
                    case TokenKind.CommentBlock:
                    case TokenKind.CommentLine:
                        break;
                    case TokenKind.NewLine:
                        if (stopOnNewLine) break;
                        break;
                    default:
                        return;
                }
            }
        }

        function skipOptionalNewLine() {
            while (tokens[i].kind == TokenKind.Whitespace) { i++; }
            if (tokens[i].kind == TokenKind.NewLine) i++;
        }

        function skipUntilBrace() {
            while (true) {
                i++;
                switch (tokens[i].kind) {
                    case TokenKind.EOF:
                        return;
                    case TokenKind.Tree:
                        if (tokens[i].synKind == SK.OpenBraceToken) {
                            i++;
                            skipOptionalNewLine();
                            return;
                        }
                        break;
                }
            }
        }

        function expectBlock() {
            nextNonWs()
            if (tokens[i].synKind == SK.OpenBraceToken) {
                i++;
                skipOptionalNewLine();
            } else {
                // TODO stick them into a block
                skipToStmtEnd();
            }
        }

        function skipToStmtEnd() {
            while (true) {
                let t = tokens[i]

                if (t.kind == TokenKind.EOF)
                    return;

                if (t.synKind == SK.SemicolonToken) {
                    i++;
                    skipOptionalNewLine();
                    return;
                }

                if (infixOperatorPrecedence(t.synKind)) {
                    nextNonWs(true)
                    t = tokens[i]
                    // an infix operator at the end of the line prevents the newline from ending the statement
                    if (t.kind == TokenKind.NewLine)
                        i++;
                    continue;
                }

                if (t.kind == TokenKind.NewLine) {
                    let bkp = i
                    nextNonWs();
                    t = tokens[i]
                    // if we get a infix operator other than +/- after newline, it's a continuation
                    if (infixOperatorPrecedence(t.synKind) && t.synKind != SK.PlusToken && t.synKind != SK.MinusToken) {
                        continue;
                    } else {
                        i = bkp + 1
                        return;
                    }
                }

                switch (t.synKind) {
                    case SK.ForKeyword:
                    case SK.WhileKeyword:
                    case SK.IfKeyword:
                        nextNonWs();
                        if (tokens[i].synKind == SK.OpenParenToken) {
                            expectBlock();
                        } else {
                            continue; // just continue until new line
                        }
                        return;

                    case SK.DoKeyword:
                        expectBlock();
                        i--;
                        nextNonWs();
                        if (tokens[i].synKind == SK.WhileKeyword) {
                            i++;
                            continue;
                        } else {
                            return;
                        }

                    case SK.ElseKeyword:
                        expectBlock();
                        return;

                    case SK.ClassKeyword:
                    case SK.InterfaceKeyword:
                        skipUntilBrace();
                        break;
                }

                i++;
            }
        }
    }

    function isWhitespaceOrNewLine(tok: Token) {
        return tok && (tok.kind == TokenKind.Whitespace || tok.kind == TokenKind.NewLine)
    }


    export function format(input: string): string {
        let r = tokenize(input)

        if (r.braceBalance != 0) return null

        let topTokens = r.tokens
        topTokens = matchBraces(topTokens)
        let topStmts = delimitStmts(topTokens)
        
        let ind = ""
        let output = ""
        
        topStmts.forEach(ppStmt)
        
        if (output == input)
            return null;
        
        return output

        function trimWhitespace(toks: Token[]) {
            toks = toks.slice(0)
            while (toks[0] && toks[0].kind == TokenKind.Whitespace)
                toks.shift()
            while (isWhitespaceOrNewLine(toks[toks.length - 1]))
                toks.pop()
            return toks
        }

        function ppStmt(s: Stmt) {
            output += ind
            trimWhitespace(s.tokens).forEach(ppToken);
            output += "\n"
        }

        function ppToken(t: Token) {
            output += t.text;
            let prev = ind
            switch (t.kind) {
                case TokenKind.Tree:
                    let tree = t as TreeToken
                    ind += "    "
                    tree.children.forEach(ppToken)
                    ind = prev
                    if (tree.endText)
                        output += tree.endText
                    break;
                case TokenKind.Block:
                    let blk = t as BlockToken;
                    output += "\n"
                    ind += "    "
                    blk.stmts.forEach(ppStmt)
                    break;
                case TokenKind.NewLine:
                    output += ind
                    break;
            }
        }
    }
}