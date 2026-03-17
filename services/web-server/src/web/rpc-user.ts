// <origin src="services/web-server/src/web/rpc-wks.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// RPC handlers for workspace operations
// Methods marked with @RpcMethod are automatically registered
////

import { ApiKtx } from "#common/web/koa-utils.js";
import { RpcMethod } from "#common/web/rpc.js";
import { listEntities } from "./rpc-generics.js";

// region:    --- Wks RPC Methods ---

class RpcHandlers {
  @RpcMethod("user_list")
  async listUsers(ktx: ApiKtx, params: { includes: any; filters?: any }) {
    const data = { type: "user", ...params } as any;
    return listEntities(ktx, data);
  }
}

// endregion: --- Wks RPC Methods ---
