"use strict";

/**
 * @typedef {object} MafiaTrackerOptions
 * @property {"night" | "day"} [phase]
 * @property {boolean} [end]
 * @property {number | false} [deadline]
 * @property {string[]} [add]
 * @property {string[]} [kill]
 * @property {boolean} [reveal]
 * @property {boolean} [nolynch]
 * @property {boolean | "hammer"} [selflynch]
 */
class MafiaBotGame extends Rooms.RoomGame {
	/**
     *
     * @param {Room} room
     */
	constructor(room) {
		super(room);
		this.mafiaGame = room.mafiaTracker;
		if (!this.mafiaGame) throw new Error(`Mafia game started with no tracker in room`);
		this.MafiaListeners = [
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-kill`, [room.roomid], ['kill'], true,
				(/** @type {string} */t, /** @type {string} */r, /** @type {string[]} */d) => this.onKill(d[0], d[1], d[2])),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-plur`, [room.roomid], ['plur'], true,
				(/** @type {string} */t, /** @type {string} */r, /** @type {string[]} */d) => this.onPlur(d[0])),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-start`, [room.roomid], ['gamestart'], true,
				() => { this.started = true; }),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-end`, [room.roomid], ['gameend'], true,
				() => this.destroy()),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-day`, [room.roomid], ['day'], true,
				() => this.onDay()),
		];
		this.ChatListeners = [
			Chat.addListener(`mafia-${room.roomid}-playerroles`, [room.roomid], ['html'], 1,
				(/** @type {string} */t, /** @type {string} */r, /** @type {string[]} */p) => this.parsePlayerroles(t, r, p)),
		];
		this.destroyed = false;
		this.started = false;
		/** @type {string[]} */
		this.roleList = [];
		this.deadline = 0;
		this.options = {};
	}
	/**
     * @param {string} type
     * @param {string} player
     * @param {string} role
     */
	onKill(type, player, role) {
		if (!this.started) return;
		if (role) {
			this.mafiaGame.players[toId(player)].roleRevealed = true;
			this.log(`revealed ${player} as ${role}`);
		}
	}
	onDay() {
		if (this.deadline) this.applyOption({deadline: this.deadline});
	}
	/** @param {string} player */
	onPlur(player) {
		this.sendRoom(`${player} was lynched due to plurality!`);
		this.applyOption({kill: [player]});
	}
	/**
	 * @param {string} type
	 * @param {string} roomid
	 * @param {string[]} parts
	 */
	parsePlayerroles(type, roomid, parts) {
		const message = Tools.unescapeHTML(parts.join('|'));
		if (message.slice(0, 21) !== `<div class="infobox">` || message.slice(-6) !== `</div>`) return;
		const lines = message.slice(21, -6).split('<br/>');
		for (const line of lines) {
			const parts = line.split(':');
			if (parts.length < 2) return false;
			const user = toId(parts[0]);
			const role = parts.slice(1).join(':').trim();
			if (!this.mafiaGame.players[user]) return debug(`[MAFIA] playerroles without a valid player "${user}" "${JSON.stringify(parts)}"`);
			this.mafiaGame.players[user].role = role;
		}
		this.log(`found player roles`);
		return true;
	}

	/**
     * @param {string} m
     */
	destroy(m = '') {
		this.destroyed = true;
		for (const l of this.MafiaListeners) {
			Mafia.removeMafiaListener(l);
		}
		for (const l of this.ChatListeners) {
			Chat.removeListener(l);
		}
		if (m) this.sendRoom(m);
		this.applyOption({end: true});
		super.destroy();
		return true;
	}
	/**
     * @param {MafiaTrackerOptions} options
     */
	applyOption(options) {
		if (options.end) this.sendRoom(`/mafia end`);
		if (options.phase) this.sendRoom(`/mafia ${options.phase}`);
		if (options.kill) {
			for (const p of options.kill) {
				this.sendRoom(`/mafia kill ${p}`);
			}
		}
		if (options.add) this.sendRoom(`/mafia add ${options.add.join(',')}`);
		if (options.hasOwnProperty('selflynch')) {
			if (options.selflynch === true) this.sendRoom(`/mafia enableself`);
			if (options.selflynch === false) this.sendRoom(`/mafia disableself`);
			if (options.selflynch === 'hammer') this.sendRoom(`/mafia selflynch hammer`);
		}
		if (options.hasOwnProperty('nolynch')) this.sendRoom(`/mafia ${options.nolynch ? 'enable' : 'disable'}nl`);
		if (options.hasOwnProperty('reveal')) this.sendRoom(`/mafia reveal ${options.reveal ? 'on' : 'off'}`);
		if (options.hasOwnProperty('deadline')) this.sendRoom(`/mafia dl ${options.deadline === false ? 'off' : options.deadline}`);
	}
	/**
     * @param {string} m
     */
	log(m) {
		this.mafiaGame.log(m);
	}

	/**
     * @param {string} user
     * @param {string} target
     */
	submitAction(user, target) {
		return "This type of game does not support actions";
	}
}


class Sacrifice4 extends MafiaBotGame {
	/**
     * @param {Room} room
     */
	constructor(room) {
		super(room);
		this.sendRoom(`The game will autostart at 4 players`);

		this.deadline = 8;

		this.confirmedTown = '';
		this.deadMafia = false;

		this.MafiaListeners.push(
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-join`, [room.roomid], ['join', 'add'], true,
				() => this.onJoin())
		);
	}
	onJoin() {
		if (this.mafiaGame.aliveCount === 4) {
			this.sendRoom(`The game of sacrifice is starting!`);
			this.sendRoom(`/mafia close\n/mafia setroles sacrifice\n/mafia start`);
			this.applyOption({nolynch: false, selflynch: 'hammer'});
			this.sendRoom(`/mafia playerroles`);
		}
	}
	/**
     * @param {string} type
     * @param {string} playerid
     * @param {string} role
     */
	onKill(type, playerid, role) {
		super.onKill(type, playerid, role);
		const player = this.mafiaGame.players[toId(playerid)];
		if (!player) return this.sendRoom(`Panic! - no player "${playerid}" found`);
		if (role === "Mafia Sacrifice") {
			if (this.deadMafia) {
				this.destroy(`Both mafia are dead - town wins!`);
			} else {
				this.deadMafia = true;
				this.sendRoom(`A sacrifice has died - town can be lynched normally now`);
			}
		} else {
			if (this.deadMafia) {
				this.destroy(`Mafia have 50% - mafia wins!`);
			} else {
				if (this.confirmedTown && this.confirmedTown !== playerid) {
					this.destroy(`Town have both members confirmed - town wins!`);
				} else {
					this.confirmedTown = playerid;
					this.applyOption({add: [playerid]});
				}
			}
		}
		this.applyOption({phase: "day"});
	}
}

const ASSASSIN = "Goo Assassin";
class AitC extends MafiaBotGame {
	/**
     * @param {Room} room
     */
	constructor(room) {
		super(room);

		this.deadline = 5;
		this.ChatListeners.push(
			Chat.addListener(`mafia-${room.roomid}-aitcshot`, [room.roomid], ['chat'], true,
				(/** @type {string} */r, /** @type {string} */t, /** @type {string[]} */p) => this.onMessage(r, t, p)
			));
		if (Config.mafiaAutostart) {
			this.MafiaListeners.push(
				Mafia.addMafiaListener(`mafia-${room.roomid}-deadline`, [room.roomid], ['deadline'], 1,
					() => this.start())
			);
			this.sendRoom(`The game will autostart in ${Config.mafiaAutostart} minute`);
			this.applyOption({deadline: Config.mafiaAutostart});
		}
	}

	start() {
		if (this.mafiaGame.aliveCount < 4) {
			this.destroy(`Not enough players, abandoning`);
			return false;
		}
		this.roleList = ["King", ASSASSIN, ...Array(this.mafiaGame.aliveCount - 2).fill("Guard")];
		this.sendRoom(`/mafia close\n/mafia setroles ${this.roleList.join(',')}\n/mafia start`);
		this.applyOption({phase: "night", nolynch: false});
		this.sendRoom(`The game of AitC is starting. Assassin, bold \`\`SHOOT <player>\`\` to shoot. The day will start once king PMs have been sent.`);
		this.sendRoom(`/mafia playerroles`);
	}

	parsePlayerroles() {
		if (!super.parsePlayerroles.apply(this, arguments)) return false;
		let king = '';
		for (const player of Object.values(this.mafiaGame.players)) {
			if (player.role === 'King') {
				king = player.user;
				break;
			}
		}
		if (!king) {
			this.sendRoom(`Panic! - no king found from valid roles`);
			this.destroy();
		}
		for (const player of Object.values(this.mafiaGame.players)) {
			if (player.role === ASSASSIN) continue;
			player.send(`The king is \`\`${king}\`\``);
		}
		this.applyOption({phase: "day"});
	}

	/**
     * @param {string} room
     * @param {string} type
     * @param {string[]} parts
     */
	onMessage(room, type, parts) {
		if (this.mafiaGame.phase === 'signups') return;

		const authorid = toId(parts[0]);
		const player = this.mafiaGame.players[authorid];
		if (!player) return;
		const message = parts.slice(1).join('|');
		const shot = /\*\*shoot (.*)\*\*/i.exec(message);
		if (!shot) return;
		const target = this.mafiaGame.players[toId(shot[1])];
		if (!target) return this.sendRoom(`Shot failed - target not ingame`);
		if (player.role !== ASSASSIN) {
			this.sendRoom(`/mn AUTOHOST - ${player.user} tried to shoot as ${player.role} in aitc`);
			this.applyOption({kill: [player.user]});
			return;
		}
		this.applyOption({kill: [target.user, player.user]});
		if (target.role === 'King') {
			this.destroy(`King died - Assassin wins!`);
		} else {
			this.destroy(`King lives - Royalty wins!`);
		}
		return true;
	}
	/**
     * @param {string} type
     * @param {string} player
     * @param {string} role
     */
	onKill(type, player, role) {
		if (this.destroyed) return;
		if (role === 'King') return this.destroy(`King has died - Assassin wins!`);
		if (role === ASSASSIN) return this.destroy(`Assassin has failed - Royalty win!`);
		this.applyOption({phase: 'day'});
	}
}

const C_MAF = "Mafia Goon";
const C_COP = "Role Cop";
const C_JK = "Jailkeeper";
const C_VT = "Vanilla Townie";
class Classic6 extends MafiaBotGame {
	/**
     * @param {Room} room
     */
	constructor(room) {
		super(room);

		this.roleList = [C_COP, C_JK, ...Array(2).fill(C_MAF), ...Array(2).fill(C_VT)];
		this.sendRoom(`The game will autostart at 6 players`);

		/** @type {string[]} */
		this.mafia = [];
		this.cop = '';
		this.jailkeeper = '';

		this.MafiaListeners.push(
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-join`, [room.roomid], ['join', 'add'], true,
				() => this.onJoin()),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-night`, [room.roomid], ['night'], true,
				() => this.onNight()),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-deadline`, [room.roomid], ['deadline'], true,
				() => this.onDeadline()),
		);
		this.deadline = 8;
		this.actions = Object.create(null);
		this.awaitingActions = false;
	}

	onJoin() {
		if (this.mafiaGame.aliveCount === this.roleList.length) {
			this.sendRoom(`/mafia close\n/mafia setroles ${this.roleList.join(',')}\n/mafia start`);
			this.sendRoom(`/mafia playerroles`);
			this.sendRoom(`The game of classic is starting!`);
		}
	}

	onKill() {
		this.checkWincons();
	}

	onNight() {
		if (this.checkWincons()) return;
		this.sendRoom(`PM me \`\`~action target\`\` to use your action.`);
		this.applyOption({deadline: 2});
		this.awaitingActions = true;
		this.actions = Object.create(null);
		this.remainingActions = this.mafiaGame.aliveCount;
	}

	onDeadline() {
		if (this.awaitingActions) this.resolveActions();
	}

	resolveActions() {
		// this is basically rar, r-right?
		const jailkept = this.actions[C_JK];
		const mafKill = this.actions[C_MAF];
		if (mafKill && !mafKill.includes(jailkept)) this.applyOption({kill: [mafKill[1]]});
		const cop = this.actions[C_COP];
		if (cop && !this.mafiaGame.players[cop[0]].dead) {
			if (cop[0] === jailkept) {
				this.sendPM(cop[0], "No result...");
			} else {
				this.sendPM(cop[0], `${cop[1]}'s role is ${this.mafiaGame.players[cop[1]].role}`);
			}
		}
		this.applyOption({phase: "day"});
	}

	/**
     * @param {string} user
     * @param {string} target
     */
	submitAction(user, target) {
		if (!this.awaitingActions) return "It is not time to submit actions";
		const userid = toId(user);
		const targetid = toId(target);
		const player = this.mafiaGame.players[userid];
		const targetPlayer = this.mafiaGame.players[targetid];

		if (userid === targetid) return "You cannot target yourself";
		if (!player) return "You cannot use that";
		if (targetid === 'constructor') return "...";
		if (!targetPlayer) return "You cannot target that";
		this.actions[player.role] = [userid, targetid];
		return "You have submitted your target. Submitting again will change targets.";
	}

	checkWincons() {
		let protectorAlive = false;
		let scumAlive = 0;
		let townAlive = 0;
		// lynch kills happen before the game goes to night
		let intoNight = this.mafiaGame.phase === 'day';
		for (const player of Object.values(this.mafiaGame.players)) {
			if (player.dead) continue;
			if (player.role === C_MAF) {
				scumAlive++;
			} else {
				if (player.role === C_JK) protectorAlive = true;
				townAlive++;
			}
		}

		if (scumAlive >= townAlive) return this.destroy(`Mafia have majority - Mafia wins!`);
		if (scumAlive === townAlive && (!intoNight || !protectorAlive)) return this.destroy(`Mafia can guarantee 50% - Mafia wins!`);
		if (!scumAlive) return this.destroy(`All mafia have been killed - Town wins!`);
		return false;
	}


	/**
     * @param {string} user
     * @param {string} message
     */
	sendPM(user, message) {
		this.log(`sending result "${user}" => "${message}"`);
		Chat.sendPM(user, message);
	}
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

const GAMES = {
	sac: Sacrifice4,
	aitc: AitC,
	c6: Classic6,
};

/** @type {ChatCommands} */
const commands = {
	game: function (target, room, user) {
		if (!room) return;
		if (!this.can('eval')) return;
		if (room.game || room.mafiaTracker) return this.reply(`There is already a game in progress`);
		const Game = GAMES[toId(target)];
		if (!Game) return this.reply(`Invalid target`);
		room.send(`/mafia host ${Config.nick}`);
		Mafia.addMafiaListener(`mafiastart-${room.roomid}`, [room.roomid], ['host'], 1, () => { room.game = new Game(room); return true; });
	},
	action: function (target, room, user) {
		let args = target.split(',');
		room = Rooms(args[0]);
		if (room) {
			args.shift();
		} else {
			room = Rooms(Config.primaryRoom);
		}
		if (!room || !room.mafiaTracker || !room.game) return;
		const game = /** @type {MafiaBotGame} */ (room.game);
		if (!game.submitAction) return;
		const res = game.submitAction(user, args.join(''));
		if (res) this.reply(res);
	},
};

module.exports = {MafiaBotGame, commands};
