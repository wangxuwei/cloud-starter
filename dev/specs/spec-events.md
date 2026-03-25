# Spec - Events

This document defines all events in the system in TypeScript format, organized by service.

## Common Types

### Base Types

```typescript
interface org_scoped_base {
  org_id: number;
}

interface media_event extends org_scoped_base {
  media_id: number;
}

interface job_done_base {
  khost: string; // kubernetes container host name
  start: number; // js date num
  duration: number; // in second (sec.ms)
}

interface job_base {
  job_uuid?: string;
}

interface job_media_base extends job_base, media_event {
}
```

## Service: vid-init

### App Events (Data Events)

#### media_new
Sent when a new media has been added and original file uploaded to core store.

```typescript
interface media_new {
  type: 'media_new';
  org_id: number;
  media_id: number;
  media_mime_type: string; // original file mime type
}
```

#### media_main_mp4
Sent, typically by vid-init, when media main mp4 file is available.

```typescript
interface media_main_mp4 {
  type: 'media_main_mp4';
  org_id: number;
  media_id: number;
}
```

### Job Events

#### vid_init_job
Job: Initialize a media of type video, transcode in mp4 if needed.

```typescript
interface vid_init_job {
  type: 'vid_init_job';
  job_uuid?: string;
  org_id: number;
  media_id: number;
}
```

### App Events (Notification Events)

#### vid_init_done
Sent when VidInitJob is done.

```typescript
interface vid_init_done {
  type: 'vid_init_done';
  job_uuid?: string;
  org_id: number;
  media_id: number;
  khost: string; // kubernetes container host name
  start: number; // js date num
  duration: number; // in second (sec.ms)
}
```

## Service: vid-scaler

### App Events (Data Events)

#### media_scaled_mp4
Sent, typically by vid-scaler, when downscale mp4 is available.

```typescript
interface media_scaled_mp4 {
  type: 'media_scaled_mp4';
  org_id: number;
  media_id: number;
  res: '480p' | '720p' | '1080p' | '1440p' | '4k';
}
```

### Job Events

#### vid_scaler_job
Job: Scale video to specific resolution.

```typescript
interface vid_scaler_job {
  type: 'vid_scaler_job';
  job_uuid?: string;
  org_id: number;
  media_id: number;
  res: '480p' | '720p' | '1080p' | '1440p' | '4k';
}
```

### App Events (Notification Events)

#### vid_scaler_done
Sent when VidScalerJob is done.

```typescript
interface vid_scaler_done {
  type: 'vid_scaler_done';
  job_uuid?: string;
  org_id: number;
  media_id: number;
  khost: string; // kubernetes container host name
  start: number; // js date num
  duration: number; // in second (sec.ms)
  res: '480p' | '720p' | '1080p' | '1440p' | '4k';
}
```

## Service: audio-extractor

### App Events (Data Events)

#### media_audio_mp4
Sent when audio has been extracted from a video.

```typescript
interface media_audio_mp4 {
  type: 'media_audio_mp4';
  org_id: number;
  media_id: number;
}
```

### Job Events

#### vid_audio_job
Job: Extract audio from a video file.

```typescript
interface vid_audio_job {
  type: 'vid_audio_job';
  job_uuid?: string;
  org_id: number;
  media_id: number;
}
```

### App Events (Notification Events)

#### vid_audio_done
Sent when VidAudioJob is done.

```typescript
interface vid_audio_done {
  type: 'vid_audio_done';
  job_uuid?: string;
  org_id: number;
  media_id: number;
  khost: string; // kubernetes container host name
  start: number; // js date num
  duration: number; // in second (sec.ms)
}
```

## Service: audio-texter

### App Events (Data Events)

#### media_text
Sent when text has been transcribed from audio.

```typescript
interface media_text {
  type: 'media_text';
  org_id: number;
  media_id: number;
}
```

### Job Events

#### vid_text_job
Job: Transcribe audio to text using Whisper API.

```typescript
interface vid_text_job {
  type: 'vid_text_job';
  job_uuid?: string;
  org_id: number;
  media_id: number;
}
```

### App Events (Notification Events)

#### vid_text_done
Sent when VidTextJob is done.

```typescript
interface vid_text_done {
  type: 'vid_text_done';
  job_uuid?: string;
  org_id: number;
  media_id: number;
  khost: string; // kubernetes container host name
  start: number; // js date num
  duration: number; // in second (sec.ms)
}
```
