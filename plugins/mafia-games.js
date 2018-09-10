'use strict';

class Sacrifice4 extends Rooms.RoomGame {
	/**
     *
     * @param {Room} room
     */
	constructor(room) {
		super(room);
		this.mafiaGame = room.mafiaTracker;
		if (!this.mafiaGame) throw new Error(`Mafia game started with no tracker in room`);
		this.sendRoom(`A new game of sacrifice is starting! The game will autostart at 4 players.`);
		/** @type {string}  */
		this.deadMafia = '';
		/** @type {string} typescript doesnt want to infer this fsr */
		this.confirmedTown = '';
		this.listeners = [
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-join`, [room.roomid], ['join', 'add'], () => this.onJoin(), true),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-kill`, [room.roomid], ['kill'],
				(/** @type {string} */t, /** @type {string} */r, /** @type {string} */d) => this.onKill(d[0], d[1], d[2])
				, true),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-plur`, [room.roomid], ['plur'],
				(/** @type {string} */t, /** @type {string} */r, /** @type {string} */p) => this.onPlur(p[0]), true),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-end`, [room.roomid], ['gameend'], () => this.destroy(), true),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-day`, [room.roomid], ['day'], () => this.onDay(), true),
		];
	}
	onJoin() {
		if (this.mafiaGame.aliveCount === 4) {
			this.sendRoom(`/mafia close\n/mafia setroles sacrifice\n/mafia start\n/mafia enableself hammer\n/mafia disablenl`);
			this.sendRoom(`The game of sacrifice is starting!`);
		}
	}
	/**
     * @param {string} type
     * @param {string} player
     * @param {string} role
     */
	onKill(type, player, role) {
		if (!role) this.sendRoom(`Panic! no role for killed player`);
		const playerid = toId(player);
		if (toId(role).includes('sacrifice')) {
			if (this.deadMafia && this.deadMafia !== playerid) {
				this.destroy(`All mafia are dead - Town wins!`);
			} else {
				this.deadMafia = playerid;
				this.sendRoom(`Everyone can now be lynched normally`);
			}
		} else {
			if (!this.deadMafia) {
				this.sendRoom(`/mafia revive ${playerid}`);
				if (this.confirmedTown && this.confirmedTown !== playerid) {
					this.destroy(`All town members are confirmed - Town wins!`);
				} else {
					this.confirmedTown = playerid;
				}
			} else {
				this.destroy(`Mafia have 50% - Mafia wins!`);
			}
		}
		this.sendRoom(`/mafia day`);
	}
	onDay() {
		this.sendRoom(`/mafia dl 8`);
	}
	/** @param {string} player */
	onPlur(player) {
		// a bit of a hack, but this will also push it to day
		this.sendRoom(`/mafia kill ${player}`);
	}
	/**
     * @param {string} m
     */
	destroy(m = '') {
		for (const l of this.listeners) {
			Mafia.removeMafiaListener(l);
		}
		if (m) this.sendRoom(m);
		this.sendRoom('/mafia end');
		super.destroy();
	}
}

/** @typedef {((this: CommandContext, target: string, room: Room?, user: string, cmd: string, message: string) => any)} ChatCommand */
/** @typedef {{[k: string]: string | ChatCommand}} ChatCommands */

/** @type {ChatCommands} */
const commands = {
	sac4: function (target, room, user) {
		if (!room) return;
		if (!this.can('eval')) return;
		if (room.game || room.mafiaTracker) return this.reply(`There is already a game in progress`);
		room.send(`/mafia host ${Config.nick}`);
		Mafia.addMafiaListener(`mafiastart-${room.roomid}`, [room.roomid], ['host'], () => { room.game = new Sacrifice4(room); return true; }, 1);
	},
};

exports.commands = commands;
