'use strict';
const cslCtr = require('console-control-strings');
const util = require('util');
const stdoutColor = require('supports-color').stdout;

const log = {
    VERBOSE: 0,
    INFO: 2,
    WARN: 3,
    ERROR: 4
};
let level = log.INFO;
const STREAM = process.stderr;
let colorEnabled = Boolean(stdoutColor);
const COLOR_NORMAL = cslCtr.color('magenta');
const COLOR_RESET = cslCtr.color('reset');
const NEXT_PREFIX = '││││';
const END_PREFIX = '└┴┴┘';
const SPACE = ' ';

const createLevel = (lvl, fb, disp) => (...args) => {
    if (lvl < level) {
        return;
    }
    const COLOR = cslCtr.color(fb, 'bold');

    const logLine = (prefix, msg) => {
        const output = [prefix];
        if (colorEnabled) {
            output.unshift(COLOR);
            output.push(COLOR_NORMAL);
        }
        output.push(SPACE);
        output.push(msg);

        STREAM.write(`${output.join('')}\n`);
    };
    const lines = util.format(...args).split('\n');
    logLine(disp, lines.shift());
    let endLine;
    if (lines.length) {
        endLine = lines.pop();
    }
    for (const line of lines) {
        logLine(NEXT_PREFIX, line);
    }
    endLine && logLine(END_PREFIX, endLine);
    if (colorEnabled) {
        STREAM.write(COLOR_RESET);
    }
};

log.enableColor = () => {
    colorEnabled = true;
};
log.disableColor = () => {
    colorEnabled = false;
};
log.verbose = createLevel(log.VERBOSE, 'blue', 'VERB');
log.info = createLevel(log.INFO, 'green', 'INFO');
log.warn = createLevel(log.WARN, 'yellow', 'WARN');
log.error = createLevel(log.ERROR, 'red', 'ERR!');

log.setLevel = lvl => {
    if (typeof lvl === 'number') {
        level = lvl;
    }
};
module.exports = log;
