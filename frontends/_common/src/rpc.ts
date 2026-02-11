import { deepFreeze } from "utils-min";
import { randomString } from "./utils";
import { webPost } from "./web-request";

export async function rpc_invoke(method: string, params?: object, id?: any, apiPrx?: string): Promise<any> {
	apiPrx = apiPrx ?? `/wapi/rpc`;
	const data = { id: id ?? randomString(), method, params, jsonrpc: "2.0" };

	const response: any = await webPost(`${apiPrx}`, { body: data });
	if (response.error != null) {
		console.log("ERROR - rpc_invoke - rpc_invoke error", response);
		throw response.error;
	} else {
		return deepFreeze(response.result);
	}
}
