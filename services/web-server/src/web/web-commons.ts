import { orgDao } from '#common/da/daos';
import { ApiKtx } from '#common/web/koa-utils.js';
import { Wks } from '#shared/entities.js';
import { asNum } from 'utils-min';

/** Get the orgId from reques, and get the Wks object */
export async function getWksFromReq(ktx: ApiKtx): Promise<Partial<Wks>> {
	const ctx = ktx.state.utx;
	const qOrgId = ktx.query.orgId;
	const orgId = asNum((typeof qOrgId == 'string') ? qOrgId : null);

	// guard if no wks id
	if (orgId == null) {
		throw new Error(`Cannot list tickets because now 'orgId' query param provided`)
	}
	const wks = orgDao.get(ctx, orgId);
	return wks;
}