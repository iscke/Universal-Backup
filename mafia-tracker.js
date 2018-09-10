'use strict';

let Mafia = module.exports;
Mafia.listeners = {};

/**
 * @param {string} id
 * @param {string[] | true} rooms
 * @param {string[] | true} events
 * @param {function} callback
 * @param {number | true} repeat
 */
Mafia.addMafiaListener = function (id, rooms, events, callback, repeat = true) {
	if (Mafia.listeners[id]) throw new Error(`Trying to add existing mafia listener: '${id}'`);
	Mafia.listeners[id] = {rooms, events, callback, repeat};
	return id;
};
/**
 * @param {string} id
 */
Mafia.removeMafiaListener = function (id) {
	if (!Mafia.listeners[id]) throw new Error(`Trying to remove nonexistent mafia listener: '${id}'`);
	delete Mafia.listeners[id];
	return id;
};

/**
 * @param {string} roomid
 * @param {string} event
 * @param {string[]} details
 * @param {string} message
 */
function emitEvent(roomid, event, details, message) {
	for (const id in Mafia.listeners) {
		const listener = Mafia.listeners[id];
		if (listener.events !== true && !listener.events.includes(event)) continue;
		if (listener.rooms !== true && !listener.rooms.includes(roomid)) continue;
		const result = listener.callback(event, roomid, details, message);

		if (result === true) {
			if (listener.repeat !== true) listener.repeat--;
			if (listener.repeat === 0) delete Mafia.listeners[id];
		}
	}
	log(`MAFIAEVENT: ${event}: ${JSON.stringify(details)} in ${roomid}: "${message}"`);
}

/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseChat(messageType, roomid, parts) {
	const author = parts[0];
	const message = parts.slice(1).join('|');

	if (author === '~') {
		let lynch = /^(.*) has (lynch|unlynch)ed (.*)\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', [lynch[2], lynch[1], lynch[3]], message);
		lynch = /^(.*) has shifted their lynch from (.*) to (.*)$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', ['shift', ...lynch.slice(1, 4)], message);
		lynch = /^(.*) has abstained from lynching\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', ['nolynch', lynch[1]], message);
		lynch = /^(.*) is no longer abstaining from lynching\.$/.exec(message);
		if (lynch) return emitEvent(roomid, 'lynch', ['unnolynch', lynch[1]], message);

		const playerList = /^\*\*Players \(\d+\)\*\*: (.*)$/.exec(message);
		if (playerList) return emitEvent(roomid, 'players', [playerList[1]], message);
	} else {
		const host = /^\/log (.*) was appointed the mafia host by (.*)\.$/.exec(message);
		if (host) return emitEvent(roomid, 'host', [host[1], host[2]], message);
	}
}

/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseHTML(messageType, roomid, parts) {
	const message = Tools.unescapeHTML(parts.join('|'));
	if (message === '<div class="broadcast-blue">The game of Mafia is starting!</div>') return emitEvent(roomid, 'gamestart', [], message);
	if (message === 'mafia|<div class="infobox">The game of Mafia has ended.</div>') return emitEvent(roomid, 'gameend', [], message);

	const night = /^<div class="broadcast-blue">Night (\d+). PM the host your action, or idle\.<\/div>$/.exec(message);
	if (night) return emitEvent(roomid, 'night', [night[1]], message);
	const day = /^<div class="broadcast-blue">Day (\d+)\. The hammer count is set at (\d+)<\/div>$/.exec(message);
	if (day) return emitEvent(roomid, 'day', day.slice(1, 3), message);

	let kill = /^<div class="broadcast-blue">(.+) was kicked from the game!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kill', ['kick', kill[1]], message);
	kill = /^<div class="broadcast-blue">(.+) has been treestumped!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kill', ['treestump', kill[1]], message);
	kill = /^<div class="broadcast-blue">(.+) became a restless spirit!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kill', ['spirit', kill[1]], message);
	kill = /^<div class="broadcast-blue">(.+) became a restless treestump!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kill', ['spiritstump', kill[1]], message);

	kill = /^<div class="broadcast-blue">(.+) was eliminated! .+'s role was <span style="font-weight:bold;color:(.+)">(.+)<\/span>\.<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'kill', ['kill', kill[1], kill[3], kill[2]], message); // player, role, color

	kill = /^<div class="broadcast-blue">(.+) was revived!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'revive', [kill[1]], message);

	kill = /^<div class="broadcast-blue">(.+) has been added to the game by (.+)!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'add', kill.slice(1, 3), message);

	kill = /^<div class="broadcast-blue">Hammer! (.+) was lynched!<\/div>$/.exec(message);
	if (kill) return emitEvent(roomid, 'hammer', [kill[1]], message);

	let hammer = /^<div class="broadcast-blue">The hammer count has been set at (\d+), and lynches have been reset\.<\/div>$/.exec(message);
	if (hammer) return emitEvent(roomid, 'sethammer', ['reset', hammer[1]], message);
	hammer = /^<div class="broadcast-blue">The hammer count has been shifted to (\d+)\. Lynches have not been reset\.<\/div>$/.exec(message);
	if (hammer) return emitEvent(roomid, 'sethammer', ['shift', hammer[1]], message);

	let deadline = /^<strong>The deadline has been set for (\d+) minutes\.<\/strong>$/.exec(message);
	if (deadline) return emitEvent(roomid, 'deadlineset', [deadline[1]], message);
	deadline = /^<strong>The deadline is in (\d+) minutes(?: (\d+) seconds)?\.$/.exec(message);
	if (deadline) return emitEvent(roomid, 'deadline', deadline.slice(1, 3), message);
}
/**
 * @param {string} messageType
 * @param {string} roomid
 * @param {string[]} parts
 */
function parseRaw(messageType, roomid, parts) {
	const message = parts.join('|');
	const leave = /^(.*) has (join|left)(?:ed)? the game\.$/.exec(message);
	if (leave) return emitEvent(roomid, leave[2], [leave[1]], message);
	const plur = /^Plurality is on (.*)$/.exec(message);
	if (plur) return emitEvent(roomid, 'plur', [plur[1]], message);
}

Chat.addListener("mafia-events-chat", true, ['chat'], parseChat, true);
Chat.addListener("mafia-events-html", true, ['html', 'uhtml'], parseHTML, true);
Chat.addListener("mafia-events-raw", true, ['raw'], parseRaw, true);

/**
 * @typedef {function} MafiaCallback
 * @param {string[]} details
 * @param {string?} message
 * @returns {void}
 */

class MafiaPlayer extends Rooms.RoomGamePlayer {
	/**
	 * @param {string} user
	 */
	constructor(user) {
		super(user);
		this.dead = false;
		this.spirit = false;
		this.treestump = false;
	}
}

class MafiaTracker extends Rooms.RoomGame {
	/**
	 * @param {Room} room
	 * @param {string} host
	 */
	constructor(room, host) {
		super(room);

		this.players = {};
		this.aliveCount = 0;
		this.deadCount = 0;

		this.host = host;
		this.hostid = toId(host);
		/** @type {"signups" | "locked" | "IDEApicking" | "IDEAlocked" | "day" | "night"} */
		// locked doesnt get used cause it's a pain to detect and also not relevent
		this.phase = "signups";

		this.log(`init ${this.host}`);
	}

	/** @param {string} player */
	onJoin(player) {
		log(`join ${player}`);
		this.addPlayer(player);
	}
	/** @param {string} player */
	onLeave(player) {
		log(`leave ${player}`);
		this.removePlayer(player);
	}
	/**
	 * @param {string} type
	 * @param {string} player
	 * @param {string} role
	 */
	onKill(type, player, role = '') {
		console.log(`${type}/${player}/${role}`);
		const userid = toId(player);
		this.players[userid].dead = true;
		this.players[userid].spirit = type.includes('spirit');
		this.players[userid].treestump = type.includes('stump');
		this.log(`killed ${userid}`);
		this.aliveCount--;
		if (this.phase !== 'signups') {
			this.deadCount++;
		} else {
			delete this.players[userid];
		}
	}
	/** @param {string} player */
	onRevive(player) {
		const userid = toId(player);
		this.players[userid].dead = false;
		this.players[userid].spirit = false;
		this.players[userid].treestump = false;
		this.aliveCount++;
		this.deadCount--;
	}

	onDay() {
		this.phase = 'day';
	}
	onNight() {
		this.phase = 'night';
	}
	/**
	 * @param {string} player
	 */
	addPlayer(player) {
		const playerid = toId(player);
		this.players[playerid] = new MafiaPlayer(player);
		this.aliveCount++;
		this.log(`addPlayer ${playerid}`);
	}
	/**
	 * @param {string} player
	 */
	removePlayer(player) {
		const playerid = toId(player);
		if (this.players[playerid].dead) {
			this.deadCount--;
		} else {
			this.aliveCount--;
		}
		delete this.players[playerid];
		this.log(`removePlayer ${playerid}`);
	}

	/**
	 * @param {string} m
	 */
	log(m) {
		if (!Config.mafiaDebug) return;
		if (Config.mafiaDebug === true) this.sendRoom(m);
		console.log(`[MAFIA] ${m}`);
	}
}

/**
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 */
function onGameStart(event, roomid, details) {
	const room = Rooms(roomid);
	if (!room) return;
	room.mafiaTracker = new MafiaTracker(room, details[0]);
}
/**
 * @param {string} event
 * @param {string} roomid
 */
function onGameEnd(event, roomid) {
	const room = Rooms(roomid);
	if (!room || !room.mafiaTracker) return;
	room.mafiaTracker.destroy();
	room.mafiaTracker = null;
}
/**
 *
 * @param {string} event
 * @param {string} roomid
 * @param {string[]} details
 * @param {string} message
 */
function onEvent(event, roomid, details, message) {
	const room = Rooms(roomid);
	if (!room || !room.mafiaTracker) return;
	switch (event) {
	case 'kill':
		room.mafiaTracker.onKill(details[0], details[1], details[2]);
		break;
	case 'add':
		room.mafiaTracker.addPlayer(details[0]);
		break;
	case 'join':
		room.mafiaTracker.onJoin(details[0]);
		break;
	case 'left':
		room.mafiaTracker.onLeave(details[0]);
		break;
	case 'revive':
		room.mafiaTracker.onRevive(details[0]);
		break;
	case 'day':
		room.mafiaTracker.onDay();
		break;
	case 'night':
		room.mafiaTracker.onNight();
		break;
	default:
		debug(`Unknown mafia even ${event}`);
	}
}
Mafia.addMafiaListener('mafiatracker-gamestart', true, ['host'], onGameStart, true);
Mafia.addMafiaListener('mafiatracker-gameend', true, ['gameend'], onGameEnd, true);
Mafia.addMafiaListener('mafiatracker-events', true, ['kill', 'add', 'join', 'left', 'revive', 'day', 'night'], onEvent, true);
