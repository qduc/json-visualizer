// --- DOM Elements ---
const inputArea = document.getElementById('json-input');
const outputArea = document.getElementById('json-output');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const infoToast = document.getElementById('info-toast');
const infoMessage = document.getElementById('info-message');
const inputStatus = document.getElementById('input-status');
const wrapToggleBtn = document.getElementById('wrap-toggle');
const escapeJsonBtn = document.getElementById('escape-json-btn');
const unescapeJsonBtn = document.getElementById('unescape-json-btn');
const unescapeHint = document.getElementById('unescape-hint');
const maximizeBtn = document.getElementById('maximize-btn');
const lineNumbers = document.getElementById('line-numbers');

let debounceTimer;
let isWrapEnabled = true;
let isMaximized = false;
let resizeDebounceTimer;
let lineNumberUpdateScheduled = false;
let mirrorElement = null;

// --- Event Listeners ---
inputArea.addEventListener('input', () => {
    updateStatus();
    updateEscapeButtons();
    scheduleLineNumberUpdate();
    hideError();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        processJSON();
    }, 800);
});

// Sync scroll between textarea and line numbers
inputArea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = inputArea.scrollTop;
});

// Use ResizeObserver for robust resize handling
const resizeObserver = new ResizeObserver(() => {
    scheduleLineNumberUpdate();
});
resizeObserver.observe(inputArea);

// --- Core Functions ---
function scheduleLineNumberUpdate() {
    if (lineNumberUpdateScheduled) return;
    lineNumberUpdateScheduled = true;
    requestAnimationFrame(() => {
        lineNumberUpdateScheduled = false;
        updateLineNumbers();
    });
}

function updateLineNumbers() {
    const text = inputArea.value;
    const lines = text.split('\n');
    const lineCount = lines.length;

    // Handle empty input
    if (text === '') {
        lineNumbers.innerHTML = '<div class="line-num">1</div>';
        return;
    }

    if (!isWrapEnabled) {
        // Simple case: no wrapping, just show line numbers 1 to N as block elements
        const lineNumbersHTML = lines.map((_, i) =>
            `<div class="line-num">${i + 1}</div>`
        ).join('');
        lineNumbers.innerHTML = lineNumbersHTML;
        return;
    }

    // Complex case: wrapping enabled - use mirror element strategy
    // Create or reuse mirror element
    if (!mirrorElement) {
        mirrorElement = document.createElement('div');
        mirrorElement.id = 'textarea-mirror';
        mirrorElement.style.position = 'absolute';
        mirrorElement.style.visibility = 'hidden';
        mirrorElement.style.pointerEvents = 'none';
        mirrorElement.style.overflow = 'hidden';
        mirrorElement.style.height = 'auto';
        document.body.appendChild(mirrorElement);
    }

    const computedStyle = window.getComputedStyle(inputArea);

    // Critical: Calculate content width (subtract padding from clientWidth)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const contentWidth = inputArea.clientWidth - paddingLeft - paddingRight;

    // Copy all relevant text layout styles from textarea to mirror
    mirrorElement.style.width = contentWidth + 'px';
    mirrorElement.style.font = computedStyle.font;
    mirrorElement.style.fontSize = computedStyle.fontSize;
    mirrorElement.style.fontFamily = computedStyle.fontFamily;
    mirrorElement.style.fontWeight = computedStyle.fontWeight;
    mirrorElement.style.lineHeight = computedStyle.lineHeight;
    mirrorElement.style.letterSpacing = computedStyle.letterSpacing;
    mirrorElement.style.wordSpacing = computedStyle.wordSpacing;
    mirrorElement.style.whiteSpace = computedStyle.whiteSpace;
    mirrorElement.style.wordBreak = computedStyle.wordBreak;
    mirrorElement.style.overflowWrap = computedStyle.overflowWrap;
    mirrorElement.style.tabSize = computedStyle.tabSize;
    mirrorElement.style.padding = '0';
    mirrorElement.style.margin = '0';
    mirrorElement.style.border = 'none';
    mirrorElement.style.boxSizing = computedStyle.boxSizing;

    // Get line height (handle 'normal' case)
    let lineHeight = parseFloat(computedStyle.lineHeight);
    if (isNaN(lineHeight)) {
        // Fallback: measure a single line
        mirrorElement.innerHTML = '<div style="white-space:pre-wrap;">M</div>';
        lineHeight = mirrorElement.firstChild.offsetHeight;
    }

    // Build mirror content with one div per logical line (batch DOM creation)
    const mirrorLines = [];
    for (let i = 0; i < lineCount; i++) {
        const lineText = lines[i];
        // Use zero-width space for empty lines so they have height
        const content = lineText === '' ? '\u200B' : lineText;
        mirrorLines.push(`<div class="mirror-line" style="white-space:pre-wrap;overflow-wrap:break-word;word-wrap:break-word;">${escapeHtml(content)}</div>`);
    }
    mirrorElement.innerHTML = mirrorLines.join('');

    // Batch read: measure all line heights
    const mirrorLineElements = mirrorElement.children;
    const lineNumbersHTML = [];

    for (let i = 0; i < lineCount; i++) {
        const mirrorLine = mirrorLineElements[i];
        const renderedHeight = mirrorLine ? mirrorLine.offsetHeight : lineHeight;
        const visualLines = Math.max(1, Math.round(renderedHeight / (lineHeight || 1)));

        // First visual line gets the line number
        lineNumbersHTML.push(`<div class="line-num">${i + 1}</div>`);

        // Wrapped continuation lines get empty placeholders with same height
        // Add a safety limit to prevent potential hangs if calculations go wrong
        const safetyLimit = 500;
        for (let j = 1; j < Math.min(visualLines, safetyLimit); j++) {
            lineNumbersHTML.push(`<div class="line-num">&nbsp;</div>`);
        }
    }

    // Batch write: update line numbers
    lineNumbers.innerHTML = lineNumbersHTML.join('');
}

// Helper to escape HTML in mirror content
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleWrap() {
    isWrapEnabled = !isWrapEnabled;

    // Update UI Button
    wrapToggleBtn.querySelector('span').textContent = isWrapEnabled ? "Wrap: On" : "Wrap: Off";

    // Toggle whitespace class on textarea
    if (isWrapEnabled) {
        inputArea.classList.remove('whitespace-pre');
        inputArea.classList.add('whitespace-pre-wrap');
    } else {
        inputArea.classList.remove('whitespace-pre-wrap');
        inputArea.classList.add('whitespace-pre');
    }

    // Update line numbers to reflect new wrapping
    scheduleLineNumberUpdate();

    // Re-process JSON to update display
    processJSON();
}

function toggleMaximize() {
    isMaximized = !isMaximized;
    const leftPane = document.querySelector('.left-pane');
    const middleBar = document.querySelector('.middle-bar');

    if (isMaximized) {
        leftPane.classList.add('hidden');
        middleBar.classList.add('hidden');
        maximizeBtn.textContent = 'Restore';
    } else {
        leftPane.classList.remove('hidden');
        middleBar.classList.remove('hidden');
        maximizeBtn.textContent = 'Maximize Tree';
    }
}

function processJSON() {
    try {
        const jsonString = inputArea.value.trim();

        if (!jsonString) {
            outputArea.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                    <p>JSON structure will appear here</p>
                </div>`;
            return;
        }

        updateEscapeButtons();

        const form = detectJsonInputForm(jsonString);
        let jsonData;
        if (form === 'escaped') {
            let jsonText;
            try {
                const v = JSON.parse(jsonString);
                jsonText = (typeof v === 'string') ? v : null;
            } catch {
                jsonText = null;
            }

            if (jsonText === null) {
                const quoted = `"${jsonString.replace(/\\/g, '\\\\').replace(/\"/g, '\\"')}"`;
                jsonText = JSON.parse(quoted);
            }

            jsonData = JSON.parse(jsonText);
        } else {
            jsonData = JSON.parse(jsonString);
        }
        outputArea.innerHTML = createTree(jsonData);

    } catch (error) {
        showError('Invalid JSON: ' + error.message);
    }
}

function createTree(data) {
    if (data === null) return '';
    const type = getType(data);

    if (type === 'object') {
        return buildNode(null, data, true);
    } else if (type === 'array') {
        return buildNode(null, data, true);
    } else {
        return buildNode(null, data, true);
    }
}

function buildNode(key, value, isLastItem) {
    const type = getType(value);
    let html = '';
    const keyHtml = key ? `<span class="json-key">"${key}"</span>: ` : '';

    if (type === 'object') {
        const entries = Object.entries(value);
        const isEmpty = entries.length === 0;

        html += `<div class="node">`;
        html += keyHtml;
        html += `<span class="collapsible-arrow" onclick="toggleNode(this.parentNode)">▶</span> `;
        html += `{<span class="collapsed-indicator" onclick="toggleNode(this.parentNode)">...${entries.length} items</span>`;

        if (!isEmpty) {
            html += `<div class="child-container">`;
            entries.forEach(([childKey, childValue], index) => {
                html += buildNode(childKey, childValue, index === entries.length - 1);
            });
            html += `</div>`;
        }

        html += `}${!isLastItem ? ',' : ''}`;
        html += `</div>`;

    } else if (type === 'array') {
        const isEmpty = value.length === 0;

        html += `<div class="node">`;
        html += keyHtml;
        html += `<span class="collapsible-arrow" onclick="toggleNode(this.parentNode)">▶</span> `;
        html += `[<span class="collapsed-indicator" onclick="toggleNode(this.parentNode)">...${value.length} items</span>`;

        if (!isEmpty) {
            html += `<div class="child-container">`;
            value.forEach((item, index) => {
                html += buildNode(null, item, index === value.length - 1);
            });
            html += `</div>`;
        }

        html += `]${!isLastItem ? ',' : ''}`;
        html += `</div>`;

    } else {
        let valueClass = '';
        let displayValue = value;

        if (type === 'string') {
            valueClass = 'json-string';
            displayValue = `"${value}"`;
        } else if (type === 'number') {
            valueClass = 'json-number';
        } else if (type === 'boolean') {
            valueClass = 'json-boolean';
            displayValue = value ? 'true' : 'false';
        } else if (value === null) {
            valueClass = 'json-null';
            displayValue = 'null';
        }

        html += `<div class="node">`;
        html += keyHtml;
        html += `<span class="${valueClass}">${displayValue}</span>${!isLastItem ? ',' : ''}`;
        html += `</div>`;
    }

    return html;
}

function toggleNode(element) {
    element.classList.toggle('collapsed');
}

function getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function formatInput() {
    try {
        const jsonString = inputArea.value.trim();
        if (!jsonString) return;

        const jsonData = JSON.parse(jsonString);
        inputArea.value = JSON.stringify(jsonData, null, 2);
        updateStatus();
        updateEscapeButtons();
        scheduleLineNumberUpdate();
        processJSON();
    } catch (error) {
        showError('Invalid JSON: ' + error.message);
    }
}

function minifyInput() {
    try {
        const jsonString = inputArea.value.trim();
        if (!jsonString) return;

        const jsonData = JSON.parse(jsonString);
        inputArea.value = JSON.stringify(jsonData);
        updateStatus();
        updateEscapeButtons();
        scheduleLineNumberUpdate();
        processJSON();
    } catch (error) {
        showError('Invalid JSON: ' + error.message);
    }
}

function clearAll() {
    inputArea.value = '';
    outputArea.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <p>JSON structure will appear here</p>
        </div>`;
    updateStatus();
    updateEscapeButtons();
    scheduleLineNumberUpdate();
    hideError();
}

function detectJsonInputForm(raw) {
    const s = (raw ?? '').trim();
    if (!s) return 'unknown';

    const tryParse = (text) => {
        try {
            return { ok: true, value: JSON.parse(text) };
        } catch {
            return { ok: false, value: null };
        }
    };

    const looksLikeJson = (text) => {
        const t = (text ?? '').trim();
        if (!t) return false;
        return t.startsWith('{') || t.startsWith('[') || t === 'null' || t === 'true' || t === 'false' || /^-?\d/.test(t);
    };

    const asJson = tryParse(s);
    if (asJson.ok) {
        if (typeof asJson.value === 'string') {
            const inner = asJson.value.trim();
            if (looksLikeJson(inner) && tryParse(inner).ok) return 'escaped';
            return 'unknown';
        }
        return 'json';
    }

    // Try unquoted escaped form (e.g. {\"a\":1})
    try {
        const simpleQuoted = `"${s}"`;
        const decoded = JSON.parse(simpleQuoted);
        if (typeof decoded === 'string') {
            const inner = decoded.trim();
            if (looksLikeJson(inner) && tryParse(inner).ok) return 'escaped';
        }
    } catch {}

    // Try treating as raw text that needs escaping
    try {
        const quoted = `"${s.replace(/\\/g, '\\\\').replace(/\"/g, '\\"')}"`;
        const decoded = JSON.parse(quoted);
        if (typeof decoded === 'string') {
            const inner = decoded.trim();
            if (looksLikeJson(inner) && tryParse(inner).ok) return 'escaped';
        }
    } catch {
    }

    return 'unknown';
}

function getEscapeDepth(raw) {
    const s = (raw ?? '').trim();
    if (!s) return 0;

    const tryParse = (text) => {
        try {
            return { ok: true, value: JSON.parse(text) };
        } catch {
            return { ok: false, value: null };
        }
    };

    const tryUnescapeUnquoted = (text) => {
        try {
            const simpleQuoted = `"${text}"`;
            const v = JSON.parse(simpleQuoted);
            if (typeof v === 'string') return { ok: true, value: v };
        } catch {}

        try {
            const quoted = `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            const v = JSON.parse(quoted);
            if (typeof v === 'string') return { ok: true, value: v };
        } catch {
            return { ok: false, value: null };
        }
        return { ok: false, value: null };
    };

    const looksLikeJson = (text) => {
        const t = (text ?? '').trim();
        if (!t) return false;
        return t.startsWith('{') || t.startsWith('[') || t === 'null' || t === 'true' || t === 'false' || /^-?\d/.test(t);
    };

    let depth = 0;
    let current = s;
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
        iterations++;
        let parsed = tryParse(current);
        if (!parsed.ok) {
            const unquoted = tryUnescapeUnquoted(current);
            if (unquoted.ok) {
                parsed = unquoted;
            } else {
                break;
            }
        }

        if (typeof parsed.value === 'string') {
            const inner = parsed.value.trim();
            if (inner !== current && tryParse(inner).ok) {
                current = inner;
                depth++;
                continue;
            }
        }
        break;
    }

    return depth;
}

function updateEscapeButtons() {
    if (!escapeJsonBtn || !unescapeJsonBtn) return;

    const form = detectJsonInputForm(inputArea.value);

    if (form === 'escaped') {
        unescapeJsonBtn.classList.remove('hidden');
        escapeJsonBtn.classList.add('hidden');

        const depth = getEscapeDepth(inputArea.value);
        if (unescapeHint) {
            if (depth > 1) {
                unescapeHint.textContent = depth + 'x';
                unescapeHint.title = 'Content is escaped ' + depth + ' times. Click to unescape one level.';
                unescapeHint.classList.remove('hidden');
            } else {
                unescapeHint.classList.add('hidden');
            }
        }
    } else if (form === 'json') {
        escapeJsonBtn.classList.remove('hidden');
        unescapeJsonBtn.classList.add('hidden');
        if (unescapeHint) unescapeHint.classList.add('hidden');
    } else {
        escapeJsonBtn.classList.add('hidden');
        unescapeJsonBtn.classList.add('hidden');
        if (unescapeHint) unescapeHint.classList.add('hidden');
    }
}

function escapeJsonInput() {
    try {
        const jsonString = inputArea.value.trim();
        if (!jsonString) return;

        const jsonData = JSON.parse(jsonString);
        const minified = JSON.stringify(jsonData);
        inputArea.value = JSON.stringify(minified);
        updateStatus();
        updateEscapeButtons();
        scheduleLineNumberUpdate();
        processJSON();
    } catch (error) {
        showError('Invalid JSON: ' + error.message);
    }
}

function executeUnescape(raw) {
    if (!raw) return raw;

    // Try parsing directly first (for quoted strings like "\"hello\"")
    try {
        const directParsed = JSON.parse(raw);
        if (typeof directParsed === 'string') {
            return directParsed;
        }
    } catch {}

    // If direct parse fails, try wrapping in quotes
    try {
        // First try simple wrapping (for unquoted escaped content like {\"name\": \"John\"})
        const simpleQuoted = `"${raw}"`;
        return JSON.parse(simpleQuoted);
    } catch {}

    // If that fails, assume raw text that needs escaping (for 'Hello "World"')
    const quoted = `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    return JSON.parse(quoted);
}

function unescapeJsonInput() {
    const raw = inputArea.value.trim();
    if (!raw) return;

    try {
        const parsed = executeUnescape(raw);

        // Check if the unescaped result is valid JSON that we should pretty-print
        // But only if it's not still an escaped string (to avoid double-unescaping)
        const form = detectJsonInputForm(parsed);
        if (form === 'json') {
            // Result is valid JSON (object/array), pretty-print it
            const jsonData = JSON.parse(parsed);
            inputArea.value = JSON.stringify(jsonData, null, 2);
        } else {
            // Result is still escaped or unknown, show as-is
            inputArea.value = parsed;
        }

        updateStatus();
        updateEscapeButtons();
        scheduleLineNumberUpdate();
        processJSON();
    } catch (error) {
        showError('Unescape failed: ' + error.message);
    }
}

function expandAll() {
    document.querySelectorAll('.collapsed').forEach(el => el.classList.remove('collapsed'));
}

function collapseAll() {
    const containers = document.querySelectorAll('.child-container');
    containers.forEach(container => {
        const parent = container.parentElement;
        if (!parent.classList.contains('collapsed')) {
            parent.classList.add('collapsed');
        }
    });
}

function copyOutput() {
    try {
        const jsonString = inputArea.value.trim();
        if (!jsonString) return;

        const form = detectJsonInputForm(jsonString);
        let jsonData;
        if (form === 'escaped') {
            let jsonText;
            try {
                const v = JSON.parse(jsonString);
                jsonText = (typeof v === 'string') ? v : null;
            } catch {
                jsonText = null;
            }

            if (jsonText === null) {
                const quoted = `"${jsonString.replace(/\\/g, '\\\\').replace(/\"/g, '\\"')}"`;
                jsonText = JSON.parse(quoted);
            }

            jsonData = JSON.parse(jsonText);
        } else {
            jsonData = JSON.parse(jsonString);
        }

        const formattedJson = JSON.stringify(jsonData, null, 2);

        navigator.clipboard.writeText(formattedJson).then(() => {
            showCopyToast();
        }).catch(err => {
            showError('Failed to copy: ' + err.message);
        });
    } catch (error) {
        showError('Invalid JSON: ' + error.message);
    }
}

function showCopyToast() {
    const toast = document.getElementById('copy-toast');
    toast.classList.remove('opacity-0');
    setTimeout(() => {
        toast.classList.add('opacity-0');
    }, 2000);
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorToast.classList.remove('hidden');
    errorToast.classList.add('shake-animation');

    // Remove animation class after it completes
    setTimeout(() => {
        errorToast.classList.remove('shake-animation');
    }, 500);
}

function hideError() {
    errorToast.classList.add('hidden');
}

let infoToastTimer;
function showInfo(msg, duration = 3000) {
    infoMessage.textContent = msg;
    infoToast.classList.remove('hidden');

    clearTimeout(infoToastTimer);
    infoToastTimer = setTimeout(() => {
        infoToast.classList.add('hidden');
    }, duration);
}

function updateStatus() {
    const length = inputArea.value.length;
    inputStatus.textContent = `${length} ${length === 1 ? 'char' : 'chars'}`;
}

// Initialize
updateStatus();
updateEscapeButtons();
scheduleLineNumberUpdate();

// Export for Node.js based testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        detectJsonInputForm,
        getEscapeDepth,
        executeUnescape
    };
}

