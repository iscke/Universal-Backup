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
		this.MafiaListeners = [
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-join`, [room.roomid], ['join', 'add'], true,
				() => this.onJoin()),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-kill`, [room.roomid], ['kill'], true,
				(/** @type {string} */t, /** @type {string} */r, /** @type {string[]} */d) => this.onKill(d[0], d[1], d[2])),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-plur`, [room.roomid], ['plur'], true,
				(/** @type {string} */t, /** @type {string} */r, /** @type {string[]} */d) => this.onPlur(d[0])),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-end`, [room.roomid], ['gameend'], true,
				() => this.destroy()),
			Mafia.addMafiaListener(`mafiagame-${room.roomid}-day`, [room.roomid], ['day'], true,
				() => this.onDay()),
		];
		this.ChatListeners = [
			Chat.addListener(`mafia-${room.roomid}-playerroles`, [room.roomid], ['html'], 1,
				(/** @type {string} */t, /** @type {string} */r, /** @type {string[]} */p) => this.parsePlayerroles(t, r, p)),
		];
	}
	onJoin() {
		if (this.mafiaGame.aliveCount === 4) {
			this.sendRoom(`/mafia close\n/mafia setroles sacrifice\n/mafia start\n/mafia enableself hammer\n/mafia disablenl\n/mafia playerroles`);
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
	 * @param {string} type
	 * @param {string} roomid
	 * @param {string[]} parts
	 */
	parsePlayerroles(type, roomid, parts) {
		const message = parts.join('|');
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
		return true;
	}

	/**
     * @param {string} m
     */
	destroy(m = '') {
		for (const l of this.MafiaListeners) {
			Mafia.removeMafiaListener(l);
		}
		for (const l of this.ChatListeners) {
			Chat.removeListener(l);
		}
		if (m) this.sendRoom(m);
		this.sendRoom('/mafia end');
		super.destroy();
	}
}

