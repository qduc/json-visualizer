// --- DOM Elements ---
const inputArea = document.getElementById('json-input');
const outputArea = document.getElementById('json-output');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const inputStatus = document.getElementById('input-status');
const wrapToggleBtn = document.getElementById('wrap-toggle');
const escapeJsonBtn = document.getElementById('escape-json-btn');
const unescapeJsonBtn = document.getElementById('unescape-json-btn');
const lineNumbers = document.getElementById('line-numbers');

let debounceTimer;
let isWrapEnabled = true;
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
        const renderedHeight = mirrorLineElements[i].offsetHeight;
        const visualLines = Math.max(1, Math.round(renderedHeight / lineHeight));

        // First visual line gets the line number
        lineNumbersHTML.push(`<div class="line-num">${i + 1}</div>`);

        // Wrapped continuation lines get empty placeholders with same height
        for (let j = 1; j < visualLines; j++) {
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

function updateEscapeButtons() {
    if (!escapeJsonBtn || !unescapeJsonBtn) return;

    const form = detectJsonInputForm(inputArea.value);

    if (form === 'escaped') {
        unescapeJsonBtn.classList.remove('hidden');
        escapeJsonBtn.classList.add('hidden');
    } else if (form === 'json') {
        escapeJsonBtn.classList.remove('hidden');
        unescapeJsonBtn.classList.add('hidden');
    } else {
        escapeJsonBtn.classList.add('hidden');
        unescapeJsonBtn.classList.add('hidden');
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

function unescapeJsonInput() {
    const raw = inputArea.value.trim();
    if (!raw) return;

    const tryUnescapeToJsonText = () => {
        try {
            const v = JSON.parse(raw);
            if (typeof v === 'string') return v;
        } catch {
        }

        const quoted = `"${raw.replace(/\\/g, '\\\\').replace(/\"/g, '\\"')}"`;
        return JSON.parse(quoted);
    };

    try {
        const jsonText = tryUnescapeToJsonText();
        if (typeof jsonText !== 'string') {
            showError('Unescape failed: expected a string result');
            return;
        }

        const jsonData = JSON.parse(jsonText);
        inputArea.value = JSON.stringify(jsonData, null, 2);
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
    errorToast.classList.remove('translate-y-20');
    errorToast.classList.add('shake-animation');

    // Remove animation class after it completes
    setTimeout(() => {
        errorToast.classList.remove('shake-animation');
    }, 500);
}

function hideError() {
    errorToast.classList.add('translate-y-20');
}

function updateStatus() {
    const length = inputArea.value.length;
    inputStatus.textContent = `${length} ${length === 1 ? 'char' : 'chars'}`;
}

// Initialize
updateStatus();
updateEscapeButtons();
scheduleLineNumberUpdate();
