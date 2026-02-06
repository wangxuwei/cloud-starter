# Vid-Scaler Service Specification

## Overview

The `vid-scaler` service is responsible for transcoding and scaling video files to different resolutions. It listens for job requests, processes videos using FFmpeg, and stores the output back in the cloud storage bucket.

## Purpose

- Transcode videos to standardized resolutions (e.g., 480p30)
- Optimize videos for bandwidth-efficient playback
- Automatically trigger downstream services (e.g., audio extraction) after scaling

## Architecture

The service consists of two main components:

### 1. Main Process (`start.ts`)

The main process runs as a worker that:
- Polls the `VidScalerJob` queue for jobs
- Downloads the original video from cloud storage
- Uses FFmpeg to transcode/scale the video
- Uploads the processed video back to cloud storage
- Updates the media record in the database
- Publishes events for downstream processing

### 2. Worker Bridge (`wkr-bridge-media-mp4.ts`)

The worker bridge:
- Listens for `MediaMainMp4` events on the application queue
- Creates `VidScalerJob` entries for processing
- Acknowledges processed stream entries

## Job Queue: VidScalerJob

### Input Data

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Fixed value: `'VidScalerJob'` |
| `orgId` | number | Organization ID |
| `mediaId` | number | Media record ID |
| `res` | string | Target resolution (e.g., `'480p30'`) |

### Processing Flow

1. **Retrieve Media Record**
   - Fetch media details using `mediaId` and `orgId`
   - Get original video filename and storage path

2. **Check Existing Output**
   - Verify if the scaled version already exists in storage
   - Skip processing if file exists

3. **Transcode Video**
   - Create temporary directory for processing
   - Download original video from cloud storage
   - Execute FFmpeg to scale/transcode the video
   - Upload processed video to cloud storage
   - Clean up temporary files

4. **Update Database**
   - Set `media.sd` field to the processed resolution (e.g., `'480p30'`)
   - Mark the `VidScalerJob` as complete

5. **Trigger Downstream Services**
   - If media type is `'video'`, publish `MediaScaledMp4` event
   - This triggers audio extraction via `audio-extractor` service

## FFmpeg Command

The service uses FFmpeg with the following parameters:

```bash
ffmpeg -i input.mp4 -vcodec libx264 -crf 23 -vf fps=30,scale=-2:480 -y output-480p30.mp4
```

### Parameter Breakdown

| Parameter | Value | Description |
|-----------|-------|-------------|
| `-vcodec` | `libx264` | H.264 video codec |
| `-crf` | `23` | Constant Rate Factor (quality: 0-51, lower is better, 23 is default) |
| `-vf fps` | `30` | Target framerate: 30 FPS |
| `scale` | `-2:480` | Height: 480px, width calculated automatically (divisible by 2) |
| `-y` | - | Overwrite output file without prompting |

### Resolution Naming Convention

Scaled files are named using the pattern: `<original-name>-<res>.mp4`

Examples:
- `s01e02-out-final.mp4` → `s01e02-out-final-480p30.mp4`
- `my-video.mp4` → `my-video-480p30.mp4`

## Storage Paths

- **Original Video**: `{CORE_STORE_ROOT_DIR}{media.folderPath}{mediaName}`
- **Scaled Video**: `{CORE_STORE_ROOT_DIR}{media.folderPath}{scaledName}`
- **Temporary Files**: `temp/{uuid}/` (local, cleaned up after processing)

## Events

### Consumed Events

| Queue | Event | Trigger |
|-------|-------|---------|
| `MediaMainMp4` | `MediaMainMp4` | New main video uploaded to storage |

### Published Events

| Queue | Event | Trigger |
|-------|-------|---------|
| `MediaScaledMp4` | `MediaScaledMp4` | Video successfully scaled (only if media.type = 'video') |

## Dependencies

- **Redis**: Queue management via `redstream`
- **PostgreSQL**: Media record storage via `knex` and `pg`
- **Cloud Storage**: File storage via `cloud-bucket` (AWS S3 or Google Cloud Storage)
- **FFmpeg**: Video transcoding (must be installed in container)

## Configuration

Environment variables (inherited from base container):
- `CORE_STORE_ROOT_DIR`: Root path for storage bucket
- Redis connection settings
- Database connection settings

## Error Handling

- FFmpeg errors are logged with stderr output
- Failed jobs remain in queue for retry
- Errors do not stop the service; it continues processing next jobs

## Usage Example

### Triggering Video Scaling

1. Upload a video file to the media storage
2. Create a media record with type `'video'`
3. The system automatically publishes a `MediaMainMp4` event
4. `wkr-bridge-media-mp4` receives the event and creates a `VidScalerJob`
5. `start.ts` processes the job and creates the scaled version
6. The `MediaScaledMp4` event triggers audio extraction

### Manual Job Creation

To manually trigger scaling for a specific media:

```typescript
const vidScalerJobQueue = getJobQueue('VidScalerJob');
await vidScalerJobQueue.add({
  type: 'VidScalerJob',
  orgId: 'your-org-id',
  mediaId: 'your-media-id',
  res: '480p30'
});
```