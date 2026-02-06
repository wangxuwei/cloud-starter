# Vid-Init Service Specification

## Overview

The `vid-init` service is a worker service responsible for initializing video media files to ensure they have everything needed for further processing in the pipeline. It guarantees that all video files are in MP4 format with H.264 codec, which is the standard format required by downstream services.

## Architecture

### Service Position in Pipeline

1. **vid-init** - Initializes video media, ensures MP4 format with H.264 codec ← **You are here**
2. **vid-scaler** - Scales video to different resolutions
3. **audio-extractor** - Extracts audio track from video (MP3 output)
4. **audio-texter** - Transcribes audio to text (TXT output)

### Worker Model

The service operates using a dual-process worker model:
- **Main Process** (`start.ts`) - Handles job processing and FFmpeg transcoding
- **Worker Thread** (`wkr-bridge-media-new.ts`) - Bridges event streams to job queues

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RUN_MODE` | No | Runtime mode (normal, DEBUG_INSPECT, DEBUG_DEMON, DEBUG_DEMON_INSPECT) | `normal` |
| `CORE_STORE_ROOT_DIR` | Yes | Root directory in cloud storage bucket | `core-store-root/` |

### Runtime Modes

- **normal** - Standard production mode
- **DEBUG_INSPECT** - Runs with Node.js inspector for debugging (port 9229)
- **DEBUG_DEMON** - Runs with nodemon for development with auto-reload
- **DEBUG_DEMON_INSPECT** - Runs with nodemon and inspector for development

### FFmpeg Configuration

The service uses FFmpeg with the following parameters:
- **Video Codec**: libx264 (H.264)
- **CRF (Constant Rate Factor)**: 20 (balance between quality and file size)
- **Command**: `ffmpeg -i input.ext -vcodec libx264 -crf 20 output.mp4`

CRF 20 provides good visual quality while keeping file size reasonable. Lower values (0-18) give higher quality but larger files, higher values (23-30) give smaller files but lower quality.

## Input/Output

### Input

The service processes video files from cloud storage:
- **Source**: Any video format (MOV, AVI, MKV, MP4, etc.)
- **Location**: Cloud storage bucket path under media folder
- **Event**: `MediaNew` event from upstream services

### MediaNew Event Structure

```typescript
{
  type: 'MediaNew',
  orgId: number,
  mediaId: number,
  mediaMimeType: string  // e.g., "video/mp4", "video/quicktime"
}
```

### Output

- **Format**: MP4 video file
- **Video Codec**: H.264 (libx264)
- **Location**: Same media folder in cloud storage
- **Naming**: Original filename changed to `.mp4` extension
- **Encoding**: Standard MP4 container with H.264 video

Example: If input is `video.mov`, output will be `video.mp4`

### MediaMainMp4 Event

After processing, the service emits:
```typescript
{
  type: 'MediaMainMp4',
  orgId: number,
  mediaId: number
}
```

This event signals downstream services that the video is ready for further processing.

## Processing Logic

### Transcoding Decision

The service checks the MIME type of the media file:
- If `video/mp4` and file exists: Skips transcoding
- If not `video/mp4` or file doesn't exist: Transcodes to MP4

### Transcoding Process

1. **Download** original video to temporary directory
2. **Transcode** using FFmpeg to MP4 with H.264
3. **Upload** transcoded MP4 back to cloud storage
4. **Update** media record with new filename
5. **Emit** `MediaMainMp4` event for downstream processing

### Temporary File Handling

- Temporary directory: `temp/{uuid}/`
- Unique UUID for each job to avoid conflicts
- Files are cleaned up after processing

## Event Queue Flow

```
MediaNew (video uploaded)
    ↓
Worker bridges to VidInitJob queue
    ↓
VidInitJob (vid-init main process)
    ↓
Check if MP4 needed?
    ↓ [no]
    ↓ [yes]
Transcode to MP4 (FFmpeg)
    ↓
Update media record
    ↓
MediaMainMp4 event
    ↓
audio-extractor picks up
```

## Error Handling

The service handles various error scenarios:

1. **FFmpeg Errors**: Logs error, fails job with detailed message
2. **Download Errors**: Reports error if source file unavailable
3. **Upload Errors**: Reports error if storage upload fails
4. **Database Errors**: Reports error if media record update fails
5. **Invalid MIME Type**: Logs warning but attempts processing

All errors are logged and propagated to the job queue for monitoring and retry logic.

## Worker Thread Architecture

### Main Thread (start.ts)

- Processes `VidInitJob` queue entries
- Manages FFmpeg transcoding operations
- Interacts with database and cloud storage
- Emits downstream events

### Worker Thread (wkr-bridge-media-new.ts)

- Listens to `MediaNew` application queue
- Creates `VidInitJob` entries for video media
- Uses stream group `VidInitJobBridge` for ack tracking
- Filters non-video media (only processes `video/*` MIME types)

### Communication

The worker thread uses stream groups to ensure reliable message processing:
- Each entry is acknowledged after processing
- Prevents duplicate processing
- Enables recovery from crashes

### Logs

Check logs for:
- Job start/completion messages
- FFmpeg output and errors
- File download/upload status
- Processing timing
- Worker thread activity

## Dependencies

### Runtime

- **Node.js**: JavaScript runtime
- **FFmpeg**: Video transcoding (included in base image)

### NPM Packages

- `backlib`: Backend library utilities
- `cloud-bucket`: Cloud storage operations
- `execa`: Process execution (FFmpeg)
- `fs-aux`: File system utilities
- `knex`: Database query builder
- `moment`: Date/time handling
- `nodemon`: Development auto-reload
- `pg`: PostgreSQL client
- `redstream`: Redis stream operations
- `utils-min`: Utility functions
- `uuid`: Unique identifier generation

### Base Image

The service uses `britesnow/base-media:25-11-30` which includes:
- FFmpeg with common codecs
- Node.js runtime
- System dependencies

## References

- **FFmpeg Documentation**: https://ffmpeg.org/documentation.html
- **H.264 Codec**: https://en.wikipedia.org/wiki/H.264/MPEG-4_AVC
- **Service Code**: `services/vid-init/src/`
- **Related Services**: `services/audio-extractor/`, `services/vid-scaler/`
