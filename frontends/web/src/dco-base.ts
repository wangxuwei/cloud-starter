// <origin src="https://raw.githubusercontent.com/BriteSnow/cloud-starter/master/frontends/web/src/ts/dco-base.ts" />
// (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)

import { rpc_invoke } from "common/rpc";
import { hub } from "dom-native";

export const dcoHub = hub("dcoHub");

export class BaseDco<E, F> {
	#cmd_suffix: string;

	get cmd_suffix() {
		return this.#cmd_suffix;
	}

	constructor(cmd_suffix: string) {
		this.#cmd_suffix = cmd_suffix;
	}

	//#region    ---------- Utils ----------

	//#endregion ---------- /Utils ----------
	async get(id: number): Promise<E> {
		const result = await rpc_invoke(`${this.#cmd_suffix}_get`, { id });
		if (result.success) {
			return result.data;
		} else {
			throw result;
		}
	}

	async list(qo?: F): Promise<E[]> {
		const result = await rpc_invoke(`${this.#cmd_suffix}_list`, { ...qo });
		if (result.success) {
			return result.data;
		} else {
			throw result;
		}
	}

	async create(data: any): Promise<E> {
		const result = await rpc_invoke(`${this.#cmd_suffix}_create`, { data });
		if (result.success) {
			dcoHub.pub(this.#cmd_suffix, "create", result.data);
			return result.data;
		} else {
			throw result;
		}
	}

	async update(id: number, data: Partial<E>): Promise<any> {
		const result = await rpc_invoke(`${this.#cmd_suffix}_update`, { id, data });
		if (result.success) {
			dcoHub.pub(this.#cmd_suffix, "update", result.data);
			return result.data;
		} else {
			throw result;
		}
	}

	async delete(id: number): Promise<any> {
		const result = await rpc_invoke(`${this.#cmd_suffix}_delete`, { id });
		if (result.success) {
			dcoHub.pub(this.#cmd_suffix, "delete", result.success);
			return result.success;
		} else {
			throw result;
		}
	}
}
