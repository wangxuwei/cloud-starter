# Audio Extractor Service Specification

## Overview

The audio-extractor service extracts audio tracks from video files using FFmpeg and stores them in cloud storage. It is part of the asset processing pipeline, converting scaled videos to audio format for subsequent text transcription.

## Architecture

### Service Flow

```
Video Input -> Video Scaler -> Audio Extractor -> Audio Texter
                               (AssetScaledMp4)
```

The service operates as a queue-based worker that:
1. Listens for scaled video files from `AssetScaledMp4` queue
2. Extracts audio using FFmpeg with MP3 codec (128kbps)
3. Uploads extracted audio to cloud storage
4. Publishes `AssetAudioMp4` event for audio texter processing
5. Adds `VidTextJob` to trigger text transcription

### Worker Threads

The service runs with two main components:
- **Main Thread**: Handles the `VidAudioJob` queue, performs FFmpeg extraction
- **Worker Thread**: Listens to `AssetScaledMp4` queue and creates VidAudioJob tasks

## Queue Jobs

### Consumed Queues

#### AssetScaledMp4 (App Queue)
- **Stream Group**: `audio-extractor-bgrp`
- **Event Type**: `AssetScaledMp4`
- **Payload**:
  ```typescript
  {
    type: 'AssetScaledMp4',
    orgId: number,
    assetId: number
  }
  ```
- **Purpose**: Triggered when a video has been scaled, signaling readiness for audio extraction

#### VidAudioJob (Job Queue)
- **Event Type**: `VidAudioJob`
- **Payload**:
  ```typescript
  {
    type: 'VidAudioJob',
    orgId: number,
    assetId: number
  }
  ```
- **Purpose**: Job to extract audio from a specific asset item

### Produced Queues

#### AssetAudioMp4 (App Queue)
- **Event Type**: `AssetAudioMp4`
- **Payload**:
  ```typescript
  {
    type: 'AssetAudioMp4',
    orgId: number,
    assetId: number
  }
  ```
- **Purpose**: Notification that audio extraction is complete

#### VidTextJob (Job Queue)
- **Event Type**: `VidTextJob`
- **Payload**:
  ```typescript
  {
    type: 'VidTextJob',
    orgId: number,
    assetId: number
  }
  ```
- **Purpose**: Triggers audio-texter service to transcribe the audio

## Technical Details

### FFmpeg Command

The service uses FFmpeg with the following parameters:
```bash
ffmpeg -i <input_video> -vn -acodec libmp3lame -ab 128k -f mp3 -y <output_audio>
```

- `-vn`: No video output
- `-acodec libmp3lame`: Use MP3 codec
- `-ab 128k`: Audio bitrate 128 kbps
- `-f mp3`: Output format MP3
- `-y`: Overwrite output file if exists

### File Naming Convention

Given a video file name, the audio file is derived using `getAudioName()`:
- Input: `video-name.mp4`
- Output: `video-name-audio.mp3`

### Storage Paths

Files are stored in the cloud bucket under:
```
{CORE_STORE_ROOT_DIR}{asset.folderPath}{audioName}
```

Example: `/core-store-root/org/{orgId}/assets/{assetId}/{assetName}-audio.mp3`

### Processing Logic

1. Check if audio already exists in storage (skip if present)
2. Create temporary directory: `temp/{uuid}/`
3. Download original video from cloud storage
4. Extract audio using FFmpeg
5. Upload audio file to cloud storage
6. Cleanup temporary directory
7. Publish completion events
8. Mark job as done

### Error Handling

- FFmpeg errors are logged with stderr output
- Failed jobs are moved to failed queue with error details
- Processing continues to next job on failure (fail-fast per job)

## Environment Configuration

### Required Environment Variables

The service depends on common configuration from `#common/conf.js`:

- `CORE_STORE_ROOT_DIR`: Root directory for cloud storage paths
- Database connection settings (via knex)
- Redis connection settings (via ioredis)
- Cloud storage credentials (S3/GCS compatible)

### Optional Run Modes

Controlled via `RUN_MODE` environment variable:

| Mode | Description |
|------|-------------|
| (unset) | Normal production mode |
| `DEBUG_INSPECT` | Run with Node.js inspector for debugging |
| `DEBUG_DEMON` | Run with nodemon for auto-restart on code changes |
| `DEBUG_DEMON_INSPECT` | Nodemon with Node.js inspector enabled |

## Dependencies

### Runtime Dependencies

- `execa`: Process execution for FFmpeg
- `cloud-bucket`: Cloud storage operations (S3/GCS)
- `ioredis`: Redis queue management
- `knex`: Database access
- `redstream`: Stream-based Redis queues
- `fs-aux`: File system utilities
- `utils-min`: Utility functions (string splitting)
- `uuid`: Unique ID generation

### System Requirements

- **FFmpeg**: Must be installed and available in PATH
  - Base image: `britesnow/base-media:25-11-30` includes FFmpeg
- **Node.js**: ES2021 compatible (Node.js 16+)
- **Redis**: For queue management
- **Cloud Storage**: S3-compatible or Google Cloud Storage
- **PostgreSQL**: For asset metadata

## Usage Example

### Typical Workflow

1. Video is uploaded and processed by vid-init service
2. Video is scaled by vid-scaler service
3. vid-scaler publishes `AssetScaledMp4` event
4. audio-extractor worker receives event, creates `VidAudioJob`
5. audio-extractor extracts audio using FFmpeg
6. audio-extractor uploads audio to cloud storage
7. audio-extractor publishes `AssetAudioMp4` event
8. audio-extractor adds `VidTextJob` to queue
9. audio-texter service picks up `VidTextJob` for transcription

### Integration with Other Services

**Preceding Services:**
- `vid-init`: Initializes video processing
- `vid-scaler`: Creates scaled video versions

**Following Services:**
- `audio-texter`: Transcribes audio to text
