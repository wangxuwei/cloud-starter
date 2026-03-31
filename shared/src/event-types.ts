import { AssetResolution } from "./entities.js";

/** For all event wks scoped */
interface OrgScopedBase {
	orgId: number;
}

interface AssetEvent extends OrgScopedBase {
	assetId: number;
}

export type AllEventDic = AppEventDic & JobEventDic;

//#region    ---------- App Events ----------

//// App Data Events

export type AppEventDic = {
	// asset data events
	AssetNew: AssetNew;
	AssetMainMp4: AssetMainMp4;
	AssetScaledMp4: AssetScaledMp4;
	AssetAudioMp4: AssetAudioMp4;
	AssetText: AssetText;

	// app job done events
	VidInitDone: VidInitDone;
	VidScalerDone: VidScalerDone;
	VidAudioDone: VidAudioDone;
	VidTextDone: VidTextDone;
};

export type AppEvent = AppEventDic[keyof AppEventDic];

/** DataEvent - Sent when a new asset has been added and orginal file uploaded to core store */
export interface AssetNew extends AssetEvent {
	type: "AssetNew";
	assetMimeType: string; // original file name
}

/** DataEvent - Sent, typically by vid-init, when asset main mp4 file is available */
export interface AssetMainMp4 extends AssetEvent {
	type: "AssetMainMp4";
}

/** DataEvent - Sent, typically by vid-scaler, when downscale AssetScaledMp4 is available */
export interface AssetScaledMp4 extends AssetEvent {
	type: "AssetScaledMp4";
	res: AssetResolution;
}

/** DataEvent - Sent when audio has been extracted from a video */
export interface AssetAudioMp4 extends AssetEvent {
	type: "AssetAudioMp4";
}

/** DataEvent - Sent when text has been transcribed from audio */
export interface AssetText extends AssetEvent {
	type: "AssetText";
}

//// App Notification Events

/** Base interface for job done queue messages */
interface JobDoneBase {
	khost: string; // kubernetes container host name
	start: number; // js date num
	duration: number; // in second (sec.ms)
}

/** NotificationEvent - Sent when VidInitJob is done */
export interface VidInitDone extends JobAssetBase, JobDoneBase {
	type: "VidInitDone";
}

/** NotificationEvent - Sent when VidScalerDone is done */
export interface VidScalerDone extends JobAssetBase, JobDoneBase {
	type: "VidScalerDone";
	res: VidScalerJob["res"];
}

/** NotificationEvent - Sent when VidAudioJob is done */
export interface VidAudioDone extends JobAssetBase, JobDoneBase {
	type: "VidAudioDone";
}

/** NotificationEvent - Sent when VidTextJob is done */
export interface VidTextDone extends JobAssetBase, JobDoneBase {
	type: "VidTextDone";
}
//#endregion ---------- /App Events ----------

//#region    ---------- Job Events ----------
export type JobEventDic = {
	VidInitJob: VidInitJob;
	VidScalerJob: VidScalerJob;
	VidAudioJob: VidAudioJob;
	VidTextJob: VidTextJob;
};

export type JobEvent = JobEventDic[keyof JobEventDic];
export type JobEventName = keyof JobEventDic;

interface JobBase {
	jobUuid?: string;
}

interface JobAssetBase extends JobBase, AssetEvent {}

/**
 * Job: Initisize a asset of type video, transcode in mp4 if needed.
 */
export interface VidInitJob extends JobAssetBase {
	type: "VidInitJob";
}

/**
 * A vid-init todo message
 */
export interface VidScalerJob extends JobAssetBase {
	type: "VidScalerJob";
	res: AssetResolution;
}

/**
 * Job: Extract audio from a video file
 */
export interface VidAudioJob extends JobAssetBase {
	type: "VidAudioJob";
}

/**
 * Job: Transcribe audio to text using Whisper API
 */
export interface VidTextJob extends JobAssetBase {
	type: "VidTextJob";
}
//#endregion ---------- /Job Events ----------
