// <origin src="https://raw.githubusercontent.com/BriteSnow/cloud-starter/master/services/web-server/src/web/router-dse-generics.ts" />
// (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)

import { OrgQueryOptions } from '#common/da/dao-org.js';
import { orgDao } from '#common/da/daos.js';
import { ApiKtx, ApiRouter, routeGet } from '#common/web/koa-utils.js';



class OrgDse extends ApiRouter {

	@routeGet('/dse/Org')
	async list(ktx: ApiKtx) {
		const ctx = ktx.state.utx;

		const type = ktx.params.type;

		let queryOptions: OrgQueryOptions = { access: 'org_a_content_view' };

		// TODO need to validate
		if (typeof ktx.query.matching == 'string') {
			queryOptions.matching = JSON.parse(ktx.query.matching);
		}

		const entities = await orgDao.list(ctx, queryOptions);

		return { success: true, data: entities };
	}

}



export default function apiRouter(prefix?: string) { return new OrgDse(prefix) };