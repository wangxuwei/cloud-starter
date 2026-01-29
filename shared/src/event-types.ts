import { MediaResolution } from './entities.js';

/** For all event wks scoped */
interface OrgScopedBase {
	orgId: number;
}

interface MediaEvent extends OrgScopedBase {
	mediaId: number;
}

export type AllEventDic = AppEventDic & JobEventDic;

//#region    ---------- App Events ---------- 

//// App Data Events 

export type AppEventDic = {
	// media data events
	'MediaNew': MediaNew,
	'MediaMainMp4': MediaMainMp4
	'MediaScaledMp4': MediaScaledMp4,
	'MediaAudioMp4': MediaAudioMp4,

	// app job done events
	'VidInitDone': VidInitDone
	'VidScalerDone': VidScalerDone
	'VidAudioDone': VidAudioDone
}

export type AppEvent = AppEventDic[keyof AppEventDic];


/** DataEvent - Sent when a new media has been added and orginal file uploaded to core store */
export interface MediaNew extends MediaEvent {
	type: 'MediaNew';
	mediaMimeType: string; // original file name
}

/** DataEvent - Sent, typically by vid-init, when media main mp4 file is available */
export interface MediaMainMp4 extends MediaEvent {
	type: 'MediaMainMp4';
}

/** DataEvent - Sent, typically by vid-scaler, when downscale MediaScaledMp4 is available */
export interface MediaScaledMp4 extends MediaEvent {
	type: 'MediaScaledMp4';
	res: MediaResolution
}

/** DataEvent - Sent when audio has been extracted from a video */
export interface MediaAudioMp4 extends MediaEvent {
	type: 'MediaAudioMp4';
}

//// App Notification Events

/** Base interface for job done queue messages */
interface JobDoneBase {
	khost: string; // kubernetes container host name
	start: number; // js date num
	duration: number; // in second (sec.ms)	
}

/** NotificationEvent - Sent when VidInitJob is done */
export interface VidInitDone extends JobMediaBase, JobDoneBase {
	type: 'VidInitDone';
}

/** NotificationEvent - Sent when VidScalerDone is done */
export interface VidScalerDone extends JobMediaBase, JobDoneBase {
	type: 'VidScalerDone';
	res: VidScalerJob['res']
}

/** NotificationEvent - Sent when VidAudioJob is done */
export interface VidAudioDone extends JobMediaBase, JobDoneBase {
	type: 'VidAudioDone';
}
//#endregion ---------- /App Events ---------- 


//#region    ---------- Job Events ---------- 
export type JobEventDic = {
	'VidInitJob': VidInitJob
	'VidScalerJob': VidScalerJob
	'VidAudioJob': VidAudioJob
}

export type JobEvent = JobEventDic[keyof JobEventDic];
export type JobEventName = keyof JobEventDic;

interface JobBase {
	jobUuid?: string
}

interface JobMediaBase extends JobBase, MediaEvent {
}

/** 
 * Job: Initisize a media of type video, transcode in mp4 if needed.
 */
export interface VidInitJob extends JobMediaBase {
	type: 'VidInitJob';
}

/** 
 * A vid-init todo message 
 */
export interface VidScalerJob extends JobMediaBase {
	type: 'VidScalerJob';
	res: MediaResolution
}

/** 
 * Job: Extract audio from a video file
 */
export interface VidAudioJob extends JobMediaBase {
	type: 'VidAudioJob';
}
//#endregion ---------- /Job Events ----------
