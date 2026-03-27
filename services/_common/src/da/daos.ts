import { AssetDao } from "./dao-asset.js";
import { OAuthDao } from "./dao-oauth.js";
import { OrgDao } from "./dao-org.js";
import { PrlinkDao } from "./dao-prlink.js";
import { ProjectDao } from "./dao-project.js";
import { UserDao } from "./dao-user.js";
import { WksDao } from "./dao-wks.js";

export const userDao = new UserDao();

export const orgDao = new OrgDao();

export const wksDao = new WksDao();

export const projectDao = new ProjectDao();

export const assetDao = new AssetDao();

export const oauthDao = new OAuthDao();

export const rplinkDao = new PrlinkDao();
