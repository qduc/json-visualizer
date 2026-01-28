const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock browser environment before requiring app.js
const mockElement = {
    addEventListener: () => {},
    value: '',
    classList: {
        remove: () => {},
        add: () => {},
        toggle: () => {},
        contains: () => false
    },
    querySelector: () => mockElement,
    querySelectorAll: () => [],
    textContent: '',
    title: '',
    style: {},
    appendChild: () => {},
    firstChild: { offsetHeight: 20 },
    children: new Proxy([], {
        get: (target, prop) => {
            if (prop === 'length') return 100;
            if (typeof prop === 'string' && !isNaN(prop)) return { offsetHeight: 20 };
            return target[prop];
        }
    }),
    offsetHeight: 20,
    clientWidth: 800,
    scrollTop: 0,
    innerHTML: ''
};

global.document = {
    getElementById: () => mockElement,
    body: { appendChild: () => {} },
    createElement: () => mockElement,
    querySelectorAll: () => [],
    addEventListener: () => {}
};
global.window = {
    getComputedStyle: () => ({
        paddingLeft: '0',
        paddingRight: '0',
        lineHeight: '20px',
        fontSize: '14px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap'
    })
};
global.ResizeObserver = class {
    observe() {}
    disconnect() {}
};
global.navigator = { clipboard: {} };
global.requestAnimationFrame = (cb) => cb();

const { detectJsonInputForm, getEscapeDepth, executeUnescape, smartParseJsonInput } = require('../app.js');

describe('JSON Visualizer Core Logic', () => {

    describe('detectJsonInputForm', () => {
        it('should detect normal JSON', () => {
            assert.strictEqual(detectJsonInputForm('{"a":1}'), 'json');
            assert.strictEqual(detectJsonInputForm('[1, 2]'), 'json');
            assert.strictEqual(detectJsonInputForm('true'), 'json');
            assert.strictEqual(detectJsonInputForm('123'), 'json');
        });

        it('should detect escaped JSON', () => {
            assert.strictEqual(detectJsonInputForm('"{\\"a\\":1}"'), 'escaped');
            assert.strictEqual(detectJsonInputForm('{\\"a\\":1}'), 'escaped');
        });

        it('should detect multi-escaped JSON (3x+)', () => {
            const threeLayers = JSON.stringify(JSON.stringify(JSON.stringify({"a": 1})));
            assert.strictEqual(detectJsonInputForm(threeLayers), 'escaped');
        });

        it('should return unknown for invalid', () => {
            assert.strictEqual(detectJsonInputForm('Hello World'), 'unknown');
        });
    });

    describe('getEscapeDepth', () => {
        it('should return 0 for plain JSON', () => {
            assert.strictEqual(getEscapeDepth('{"a":1}'), 0);
        });

        it('should return 1 for 1x escaped JSON', () => {
            assert.strictEqual(getEscapeDepth('"{\\"a\\":1}"'), 1);
        });

        it('should return 2 for 2x escaped JSON', () => {
            const threeLayers = JSON.stringify(JSON.stringify(JSON.stringify({"a":1})));
            assert.strictEqual(getEscapeDepth(threeLayers), 2);
        });
    });

    describe('smartParseJsonInput', () => {
        it('should parse normal JSON', () => {
            const { value, escapeDepth } = smartParseJsonInput('{"a":1}');
            assert.deepStrictEqual(value, { a: 1 });
            assert.strictEqual(escapeDepth, 0);
        });

        it('should parse unquoted escaped JSON (e.g. {\\"a\\":1})', () => {
            const { value, escapeDepth } = smartParseJsonInput('{\\"a\\":1}');
            assert.deepStrictEqual(value, { a: 1 });
            assert.ok(escapeDepth >= 1);
        });

        it('should parse multi-escaped JSON (3 layers -> object)', () => {
            const threeLayers = JSON.stringify(JSON.stringify(JSON.stringify({"a": 1})));
            const { value, escapeDepth } = smartParseJsonInput(threeLayers);
            assert.deepStrictEqual(value, { a: 1 });
            assert.ok(escapeDepth >= 2);
        });

        it('should keep valid JSON strings as strings', () => {
            const { value, escapeDepth } = smartParseJsonInput('"hello"');
            assert.strictEqual(value, 'hello');
            assert.strictEqual(escapeDepth, 0);
        });

        it('should parse unquoted escaped JSON string (\\"hello\\")', () => {
            const { value, escapeDepth } = smartParseJsonInput('\\"hello\\"');
            assert.strictEqual(value, 'hello');
            assert.ok(escapeDepth >= 1);
        });
    });

    describe('executeUnescape', () => {
        it('should unescape standard quoted strings', () => {
            const input = '"{\\"a\\":1}"';
            const expected = '{"a":1}';
            assert.strictEqual(executeUnescape(input), expected);
        });

        it('should unescape unquoted escaped content', () => {
            const input = '{\\"a\\":1}';
            const expected = '{"a":1}';
            assert.strictEqual(executeUnescape(input), expected);
        });

        it('should handle plain text with quotes', () => {
            const input = 'Hello "World"';
            const expected = 'Hello "World"';
            assert.strictEqual(executeUnescape(input), expected);
        });

        it('should handle multi-layer unescaping (3x -> 2x)', () => {
            const three = JSON.stringify(JSON.stringify(JSON.stringify({"a":1})));
            const two = JSON.stringify(JSON.stringify({"a":1}));
            assert.strictEqual(executeUnescape(three), two);
        });
    });
});
