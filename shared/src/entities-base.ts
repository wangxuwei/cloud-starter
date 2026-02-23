// Re-export query options for backward compatibility
export * from './query_options.js';

//#region    ---------- Base Entity Types ----------
export interface StampedEntity {
	cid?: number,
	ctime?: string,
	mid?: number,
	mtime?: string
}

export interface OAuth extends StampedEntity {
	id: number;
	userId: number;
	oauth_token: string;
	oauth_id?: string;
	oauth_username?: string;
	oauth_name?: string;
	oauth_picture?: string;
}
//#endregion ---------- /Base Entity Types ----------
