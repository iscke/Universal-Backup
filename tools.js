'use strict';

const Tools = module.exports;

const crypto = require('crypto');
const https = require('https');

/**
 * Taken from pokemon-showdown
 * @param {any} text
 * @return {string}
 */
Tools.toId = function (text) {
	if (text && text.id) {
		text = text.id;
	} else if (text && text.userid) {
		text = text.userid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
};

/** @typedef {{event: string, once: boolean, callback: function}} EventHandler */

class Emitter {
	constructor() {
		/** @type {{[k: string]: EventHandler[]}} */
		this.events = {};
	}
	/**
	 * @param {string} event
	 * @param  {...any} params
	 */
	emit(event, ...params) {
		const events = this.events[event];
		if (!events || !events.length) return;
		for (let idx = 0; idx < events.length; idx++) {
			const res = events[idx].callback(...params);
			if (events[idx].once && res) {
				events.splice(idx, 1);
				idx--;
			}
		}
	}
	/**
	 * @param {string} event
	 * @param {function} callback
	 * @param {boolean} once
	 */
	on(event, callback, once = false) {
		if (!this.events[event]) this.events[event] = [];
		const eventHandler = {event, once, callback};
		this.events[event].push(eventHandler);
		return eventHandler;
	}
	/**
	 * @param {EventHandler} handler
	 */
	remove(handler) {
		const events = this.events[handler.event];
		const index = events.findIndex(e => e === handler);
		if (index < 0) return;
		events.splice(index, 1);
	}
}
Tools.Events = Emitter;

/**
 * @param {any[]} arr
 */
Tools.lazyShuffle = function* (arr) {
	/** @type {number[]} */
	let selectableKeys = Object.keys(arr).map(n => parseInt(n));
	while (selectableKeys.length) {
		yield arr[selectableKeys.splice(~~(Math.random() * selectableKeys.length), 1)[0]];
	}
};

/**
 * @param {string} user
 * @return {string[]}
 */
Tools.splitUser = function (user) {
	// happens when logging out
	if (user.charAt(0).match(/[a-z0-9]/i)) return [' ', ...user.split('@')];
	return [user.charAt(0), ...user.slice(1).split('@')];
};
/**
 * @param {string} message
 */
Tools.sanitize = function (message) {
	const messageid = toId(message);
	for (const phrase of Config.bannedWords) {
		if (messageid.includes(phrase)) return false;
	}
	return message.trim().replace(/\*+/g, '*').replace(/^[/!]+/, '');
};
/**
 * Taken from pokemon-showdown
 * @param {string} str
 */
Tools.escapeHTML = function (str) {
	if (!str) return '';
	return ('' + str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\//g, '&#x2f;');
};
/**
 * Adapted from pokemon-showdown
 * @param {string} str
 */
Tools.unescapeHTML = function (str) {
	if (!str) return '';
	return ('' + str).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x2f;/g, '/');
};
/**
 * Taken from pokemon-showdown
 * Strips HTML from a string.
 *
 * @param {string} html
 * @return {string}
 */
Tools.stripHTML = function (html) {
	if (!html) return '';
	return html.replace(/<[^>]*>/g, '');
};
/**
 * Taken from pokemon-showdown
 * Visualizes eval output in a slightly more readable form
 * @param {any} value
 */
Tools.stringify = function (value, depth = 0) {
	if (value === undefined) return `undefined`;
	if (value === null) return `null`;
	if (typeof value === 'number' || typeof value === 'boolean') {
		return `${value}`;
	}
	if (typeof value === 'string') {
		return `"${value}"`; // NOT ESCAPED
	}
	if (typeof value === 'symbol') {
		return value.toString();
	}
	if (Array.isArray(value)) {
		if (depth > 10) return `[array]`;
		return `[` + value.map(elem => Tools.stringify(elem, depth + 1)).join(`, `) + `]`;
	}
	if (value instanceof RegExp || value instanceof Date || value instanceof Function) {
		if (depth && value instanceof Function) return `Function`;
		return `${value}`;
	}
	let constructor = '';
	if (value.constructor && value.constructor.name && typeof value.constructor.name === 'string') {
		constructor = value.constructor.name;
		if (constructor === 'Object') constructor = '';
	} else {
		constructor = 'null';
	}
	if (value.toString) {
		try {
			const stringValue = value.toString();
			if (typeof stringValue === 'string' && stringValue !== '[object Object]' && stringValue !== `[object ${constructor}]`) {
				return `${constructor}(${stringValue})`;
			}
		} catch (e) {}
	}
	let buf = '';
	for (let key in value) {
		if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
		if (depth > 2 || (depth && constructor)) {
			buf = '...';
			break;
		}
		if (buf) buf += `, `;
		let displayedKey = key;
		if (!/^[A-Za-z0-9_$]+$/.test(key)) displayedKey = JSON.stringify(key);
		buf += `${displayedKey}: ` + Tools.stringify(value[key], depth + 1);
	}
	if (constructor && !buf && constructor !== 'null') return constructor;
	return `${constructor}{${buf}}`;
};

/**
 * Taken from pokemon-showdown
 * Takes a number of milliseconds and turns it into a string that specifies how long it is
 * @param {number} number
 * @param {{[key: string]: any}} options
 */
Tools.toDurationString = function (number, options = {}) {
	const date = new Date(+number);
	const parts = [date.getUTCFullYear() - 1970, date.getUTCMonth(), date.getUTCDate() - 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
	const roundingBoundaries = [6, 15, 12, 30, 30];
	const unitNames = ["second", "minute", "hour", "day", "month", "year"];
	const positiveIndex = parts.findIndex(elem => elem > 0);
	const precision = (options && options.precision ? options.precision : parts.length);
	if (options && options.hhmmss) {
		let string = parts.slice(positiveIndex).map(value => value < 10 ? "0" + value : "" + value).join(":");
		return string.length === 2 ? "00:" + string : string;
	}
	// round least significant displayed unit
	if (positiveIndex + precision < parts.length && precision > 0 && positiveIndex >= 0) {
		if (parts[positiveIndex + precision] >= roundingBoundaries[positiveIndex + precision - 1]) {
			parts[positiveIndex + precision - 1]++;
		}
	}
	return parts.slice(positiveIndex).reverse().map((value, index) => value ? value + " " + unitNames[index] + (value > 1 ? "s" : "") : "").reverse().slice(0, precision).join(" ").trim();
};

/**
 * Taken from pokemon-showdown
 * @param {string} s - string 1
 * @param {string} t - string 2
 * @param {number} l - limit
 * @return {number} - distance
 */
Tools.levenshtein = function (s, t, l = 0) {
	// Original levenshtein distance function by James Westgate, turned out to be the fastest
	/** @type {number[][]} */
	let d = [];

	// Step 1
	let n = s.length;
	let m = t.length;

	if (n === 0) return m;
	if (m === 0) return n;
	if (l && Math.abs(m - n) > l) return Math.abs(m - n);

	// Create an array of arrays in javascript (a descending loop is quicker)
	for (let i = n; i >= 0; i--) d[i] = [];

	// Step 2
	for (let i = n; i >= 0; i--) d[i][0] = i;
	for (let j = m; j >= 0; j--) d[0][j] = j;

	// Step 3
	for (let i = 1; i <= n; i++) {
		let s_i = s.charAt(i - 1);

		// Step 4
		for (let j = 1; j <= m; j++) {
			// Check the jagged ld total so far
			if (i === j && d[i][j] > 4) return n;

			let t_j = t.charAt(j - 1);
			let cost = (s_i === t_j) ? 0 : 1; // Step 5

			// Calculate the minimum
			let mi = d[i - 1][j] + 1;
			let b = d[i][j - 1] + 1;
			let c = d[i - 1][j - 1] + cost;

			if (b < mi) mi = b;
			if (c < mi) mi = c;

			d[i][j] = mi; // Step 6
		}
	}

	// Step 7
	return d[n][m];
};

/* PS colours, taken from pokemon-showdown */
/** @type {{[k: string]: string}} */
let CustomColors = {};
try {
	CustomColors = require('./config/psconfig.js').customcolors;
} catch (e) {}

/** @type {{[n: string]: string}} */
let nameCache = {};
/**
 * @param {string} n
 */
Tools.colorName = function (n) {
	n = toId(n);
	if (n in CustomColors) n = CustomColors[n];
	if (nameCache[n]) return nameCache[n];

	// borrowed from ps
	const hash = crypto.createHash('md5').update(n).digest('hex');
	let H = parseInt(hash.substr(4, 4), 16) % 360; // 0 to 360
	let S = parseInt(hash.substr(0, 4), 16) % 50 + 40; // 40 to 89
	let L = Math.floor(parseInt(hash.substr(8, 4), 16) % 20 + 30); // 30 to 49
	let C = (100 - Math.abs(2 * L - 100)) * S / 100 / 100;
	let X = C * (1 - Math.abs((H / 60) % 2 - 1));
	let m = L / 100 - C / 2;

	let R1, G1, B1;
	switch (Math.floor(H / 60)) {
	case 1: R1 = X; G1 = C; B1 = 0; break;
	case 2: R1 = 0; G1 = C; B1 = X; break;
	case 3: R1 = 0; G1 = X; B1 = C; break;
	case 4: R1 = X; G1 = 0; B1 = C; break;
	case 5: R1 = C; G1 = 0; B1 = X; break;
	case 0: default: R1 = C; G1 = X; B1 = 0; break;
	}
	let R = R1 + m, G = G1 + m, B = B1 + m;
	let lum = R * R * R * 0.2126 + G * G * G * 0.7152 + B * B * B * 0.0722; // 0.013 (dark blue) to 0.737 (yellow)
	let HLmod = (lum - 0.2) * -150; // -80 (yellow) to 28 (dark blue)
	if (HLmod > 18) HLmod = (HLmod - 18) * 2.5;
	else if (HLmod < 0) HLmod = (HLmod - 0) / 3;
	else HLmod = 0;
	// let mod = ';border-right: ' + Math.abs(HLmod) + 'px solid ' + (HLmod > 0 ? 'red' : '#0088FF');
	let Hdist = Math.min(Math.abs(180 - H), Math.abs(240 - H));
	if (Hdist < 15) {
		HLmod += (15 - Hdist) / 3;
	}

	L += HLmod;

	nameCache[n] = "color:hsl(" + Math.round(H) + "," + Math.round(S) + "%," + Math.round(L) + "%);";
	return nameCache[n];
};

const LINE_REGEX = /^[ ]?([ +%@#&~*].+): (.*)$/;
/**
 * @param {string} line
 * @returns {[string, string, string] | [string, string] | null}
 */
Tools.parsePSLine = function (line) {
	let timestamp = '';
	if (line.startsWith('[') && line.includes(']')) {
		const endTimestampIndex = line.indexOf(']');
		timestamp = line.slice(0, endTimestampIndex + 1);
		line = line.slice(endTimestampIndex + 1);
	}
	let match = LINE_REGEX.exec(line);
	if (match) {
		return [timestamp, match[1], match[2]];
	} else if (timestamp) {
		return [timestamp, line];
	}
	return null;
};
/**
 * Produces HTML that resembles a PS chat message
 * @param {string | null} timestamp
 * @param {string} author
 * @param {string} message
 */
Tools.formatHTMLMessage = function (timestamp, author, message) {
	if (!' +%@#&~'.includes(author.charAt(0))) author = ' ' + author;

	return `<div class="chat">` +
        (timestamp ? `<small>${timestamp}</small> ` : ``) +
        `<strong style="${Tools.colorName(author)}">` +
            `<small>${author.charAt(0)}</small>` +
            `<span class="username">${Tools.escapeHTML(author.slice(1))}</span>: ` +
        `</strong>` +
        `<em>${Tools.escapeHTML(message)}</em>` +
    `</div>`;
};

Tools.LYNCHES_REGEX = /^(Lynches \(Hammer: (?:\d+|NaN|Disabled)\))((?:\n\d+\*? .{1,18} \(.+\))*)/gm;
/**
 * @param {string} firstLine
 * @param {string} rest
 */
Tools.formatHTMLLynchBox = function (firstLine, rest) {
	return `<div class="notice"><div class="infobox">` +
		`<strong>${Tools.escapeHTML(firstLine)}</strong><br/>` +
		Tools.escapeHTML(rest).replace(/\n+/g, '<br/>') + '<br/>' +
	`</div></div>`;
};

Tools.SINGLE_CODE_REGEX = new RegExp(
	String.raw`^<div class="infobox"><div class="chat"><code style="white-space: pre-wrap; display: table; tab-size: 3">` +
	String.raw`(.*)` +
	String.raw`<\/code><\/div><\/div>$`,
);
Tools.MULTI_CODE_REGEX = new RegExp(
	String.raw`^<div class="infobox"><div class="chat"><details class="readmore code" style="white-space: pre-wrap; display: table; tab-size: 3">` +
	String.raw`<summary>(.*)<\/summary>` +
	String.raw`(.*)` +
	String.raw`<\/details><\/div><\/div>$`
);
/**
 * Given a !code block, tries to extract the input
 * @param {string} text
 */
Tools.findCode = function (text) {
	let match;
	if ((match = Tools.SINGLE_CODE_REGEX.exec(text))) {
		return Tools.unescapeHTML(match[1].replace(/<br \/>/g, '\n'));
	} else if ((match = Tools.MULTI_CODE_REGEX.exec(text))) {
		return Tools.unescapeHTML(
			match[1].replace(/<br \/>/g, '\n') + '\n' + match[2].replace(/<br \/>/g, '\n')
		);
	}
	return false;
};

/**
 * @param {string} hostname
 * @param {string} path
 * @param {{content?: string}} data
 */
Tools.sendWebhookMessage = function (hostname, path, data) {
	const reqOptions = {
		hostname,
		path,
		agent: false,
		method: 'POST',
		headers: {
			'Content-Type': 'multipart/form-data',
		},
	};
	const req = https.request(reqOptions, () => {});

	req.on('error', e => {
		console.error(`Error while making request: ${e.stack}`);
		return;
	});
	req.write(JSON.stringify(data));
	req.end();
};
/**
 * @param {string} data
 * @param {string} expiry
 * @returns {Promise<string>}
 */
Tools.uploadPaste = function (data, expiry) {
	return new Promise((resolve, reject) => {
		const reqOptions = {
			hostname: "pastebin.run",
			path: `/api/v1/pastes`,
			agent: false,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded ',
			},
		};
		const req = https.request(reqOptions, res => {
			let data = "";
			res.on('data', chunk => {
				data += chunk;
			});
			res.on('end', () => {
				resolve(data);
			});
		});
		req.on('error', reject);
		req.write(`code=${encodeURIComponent(data)}&expiration=${encodeURIComponent(expiry)}`);
		req.end();
	});
};
