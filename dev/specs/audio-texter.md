# Audio Texter Service Specification

## Overview

The audio-texter service is a background worker service that transcribes audio files to text using various Automatic Speech Recognition (ASR) providers. It operates within a queue-based microservices architecture, processing audio files extracted from videos and storing the resulting transcriptions.

## Architecture

### Workflow

```
AssetAudioMp4 Queue (audio-extractor)
    ↓ (trigger)
VidTextJob Queue (audio-texter internal)
    ↓ (processing)
AssetText Queue (notification to downstream)
    ↓
S3 Storage (transcription result)
```

### Components

1. **Worker Bridge** (`wkr-bridge-asset-text.ts`)
   - Listens to `AssetAudioMp4` queue
   - Creates `VidTextJob` entries for transcription processing

2. **Main Worker** (`start.ts`)
   - Processes `VidTextJob` entries from Redis queue
   - Downloads audio from S3
   - Transcribes using ASR provider
   - Uploads transcription result to S3
   - Notifies via `AssetText` queue

3. **ASR Layer** (`asr/`)
   - `transcribe.ts`: Main transcription orchestration
   - `audio-splitter.ts`: Audio chunking with FFmpeg
   - `model-impl/`: Provider implementations (GLM, OpenAI, etc.)

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ASR_API_KEY` | Yes | API key for the ASR provider |
| `ASR_MODEL` | Yes | Model identifier (e.g., `glm-4`, `openai-whisper-1`) |
| `CORE_STORE_ROOT_DIR` | Yes | Root path for S3 storage |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Yes | Database connection |
| `REDIS_HOST`, `REDIS_PORT` | Yes | Redis connection for queues |

## Queue Integration

### Input Queue: AssetAudioMp4

Emitted by `audio-extractor` service when audio extraction completes.

```typescript
interface AssetAudioMp4Event {
  type: 'AssetAudioMp4';
  orgId: string;
  assetId: string;
}
```

### Internal Queue: VidTextJob

Created by worker bridge to trigger transcription.

```typescript
interface VidTextJob {
  type: 'VidTextJob';
  orgId: string;
  assetId: string;
}
```

### Output Queue: AssetText

Emitted after successful transcription to notify downstream services.

```typescript
interface AssetTextEvent {
  type: 'AssetText';
  orgId: string;
  assetId: string;
}
```

## File Naming Conventions

### Input Files

Audio files follow the naming convention from `dao-asset.ts`:

```
{CORE_STORE_ROOT_DIR}{asset.folderPath}{audioName}
```

Where `audioName` is generated from name `asset` (the fixed name):
- Original: `asset.mp4`
- Audio: `asset-audio.mp3`

### Output Files

Transcription files are stored alongside audio:

```
{CORE_STORE_ROOT_DIR}{asset.folderPath}{textName}
```

Where `textName` is generated as:
- Original: `video-file.mp4`
- Text: `video-file-audio-text.txt`

## Processing Details

### Audio Chunking

For long audio files, the service splits audio into chunks using FFmpeg:

- Chunk duration: 10 seconds (configurable)
- Sample rate: 16000 Hz
- Bitrate: 64k
- Channels: 1 (mono)

Chunking prevents timeouts with ASR providers that have file size or duration limits.

### Transcription Flow

1. **Job Reception**: Receive `VidTextJob` from queue
2. **Metadata Lookup**: Fetch asset record from database
3. **File Check**: Verify if transcription already exists in S3
4. **Download**: Download audio to temporary directory
5. **Chunking**: Split audio if duration exceeds limit
6. **Transcription**: Send chunks to ASR provider
7. **Aggregation**: Combine transcribed segments with space separator
8. **Upload**: Save transcription to S3
9. **Notification**: Emit `AssetText` event
10. **Cleanup**: Remove temporary files

### Error Handling

- Failed jobs are logged with error details
- Jobs are marked as failed in queue (not retried automatically)
- Temporary files are cleaned up on both success and failure
- Existing transcriptions are skipped (idempotent operation)


## Adding New ASR Providers

To add a new ASR provider:

1. Create implementation file in `src/asr/model-impl/`:

```typescript
// src/asr/model-impl/newprovider.ts
import { ASR_API_KEY } from '#common/conf.js';
import { FormData } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';
import fetch from "node-fetch";

export async function transcribeWithNewProvider(
  filePath: string, 
  model: string
): Promise<string> {
  const apiKey = ASR_API_KEY;
  const formData = new FormData();
  formData.append('model', model);
  formData.append('file', await fileFromPath(filePath));

  const response = await fetch('https://api.newprovider.com/transcribe', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData as any,
  });

  const result = await response.json();
  return result.text;
}
```

2. Register in `src/asr/model-impl/index.ts`:

```typescript
import { transcribeWithNewProvider } from './newprovider.js';

registerAsrService('NEWPROVIDER', transcribeWithNewProvider);
```

3. Use with model name: `newprovider-model-name`

## Dependencies

- **Node.js**: Runtime (ES2021 modules)
- **FFmpeg**: Audio processing (installed in base image)
- **PostgreSQL**: Asset metadata storage
- **Redis**: Job queue management
- **S3/Rustfs**: Audio and transcription file storage

### Key NPM Packages

- `formdata-node`: FormData for multipart requests
- `node-fetch`: HTTP client
- `execa`: FFmpeg process execution
- `cloud-bucket`: S3 abstraction
- `ioredis`: Redis client
- `knex`: Database query builder
- `backlib`: Backend utilities

## Monitoring

### Logs

The service logs to stdout with the following format:

```
--> audio-texter (version) - starting -> 445
{queue entry data}
ERROR - audio-texter {error} (skip and go next) - cause: {cause}
```

### Queue Monitoring

Monitor queue sizes in Redis:

- `AssetAudioMp4`: Incoming audio extraction events
- `VidTextJob`: Pending transcription jobs
- `AssetText`: Completed transcriptions
