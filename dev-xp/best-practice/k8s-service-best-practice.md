
# K8s Service Best Practices

This document outlines the architectural patterns, coding standards, and deployment configurations for creating backend microservices (such as `vid-init`, `vid-scaler`, `audio-extractor`, `audio-texter`) within our Kubernetes development environment.


## 1. Architecture Overview

Our services are built as Node.js ES Modules (`type: "module"`) running in a Kubernetes cluster. The architecture relies on **Worker Threads** for CPU-intensive tasks and a **Redis-based Job Queue** system to manage work distribution.

### Key Components

*   **Main Process:** Orchestrates application lifecycle, handles signals, and spawns worker threads.
*   **Worker Threads:** Isolate heavy logic (transcoding, external API calls) to prevent blocking the main event loop.
*   **Queues:**
    *   **AppQueue (Streams):** Used for real-time event broadcasting (e.g., `AssetNew`).
    *   **JobQueue:** Used for reliable task processing (e.g., `VidInitJob`, `VidTextJob`).
*   **Storage:** Abstracted via `cloud-bucket` (supports AWS S3 and Google Cloud Storage).
*   **Database:** PostgreSQL accessed via `knex`.


## 2. Service Patterns

### 2.1. Simple Service Pattern (e.g., `vid-init`)
Use this pattern for services with focused, sequential processing logic.

**Structure:**
*   `src/start.ts`: Main entry point.
*   `src/wkr-bridge-*.ts`: Worker implementation.

**Behavior:**
1.  The `start.ts` function initializes the service and enters an infinite loop.
2.  It spawns a `worker_threads` Worker pointing to the compiled `wkr-bridge-*.js`.
3.  The Worker reads from a `JobQueue` (e.g., `getJobQueue('VidInitJob')`).
4.  The Worker processes one item, acknowledges it, and fetches the next.

**Example Worker Implementation (`wkr-bridge-asset-new.ts`):**
```typescript
import { getAppQueue, getJobQueue } from '#common/queue.js';

async function main() {
    // Input queue (Stream) - e.g., AssetNew events
    const assetQueue = getAppQueue('AssetNew');
    // Output queue (Job) - e.g., processing tasks
    const jobQueue = getJobQueue('VidInitJob');

    const streamGroup = 'ServiceBridgeGroup';

    for (;;) {
        const entry = await assetQueue.next(streamGroup);
        
        // Validate input event
        // assertEvent('AssetNew', entry.data); 

        const { orgId, assetId } = entry.data;

        // Create the job payload
        const jobPayload = { type: 'VidInitJob', orgId, assetId };
        await jobQueue.add(jobPayload);

        // Acknowledge the stream entry
        await assetQueue.ack(streamGroup, entry.id);
    }
}
```


### 2.2. Complex Service Pattern (e.g., `audio-texter`)
Use this pattern for services requiring asynchronous external interactions (APIs) or local tool execution (FFmpeg).

**Structure:**
*   `src/start.ts`: Main entry point.
*   `src/asr/`: Sub-module for Automatic Speech Recognition logic.
*   `src/asr/transcribe.ts`: Orchestrator/Worker logic for ASR.
*   `src/asr/model-impl/`: Implementations for specific models (e.g., GLM, OpenAI).

**Behavior:**
1.  Similar to simple pattern, the `start.ts` spawns a Worker.
2.  The Worker acts as a consumer for a `JobQueue`.
3.  Inside the job loop, the service may:
    *   Download files from object storage (`cloud-bucket`).
    *   Execute local CLI tools (e.g., `ffmpeg` via `execa`).
    *   Call external REST APIs (e.g., GLM Transcription API via `node-fetch`).
    *   Upload results back to object storage.
    *   Publish a new event to an `AppQueue`.

**Example Transcription Worker (`asr/transcribe.ts`):**
```typescript
import { getJobQueue, getAppQueue } from '#common/queue.js';
import { getSysContext } from '#common/user-context.js';
import { assetDao } from '#common/da/dao-asset.js';
import { getCoreBucket } from '#common/store.js';
import { transcribeToText } from './asr/transcribe.js'; // Custom logic

async function start() {
    const jobQueue = getJobQueue('VidTextJob');
    const assetTextQueue = getAppQueue('AssetText');

    for (;;) {
        const entry = await jobQueue.nextJob();
        const { orgId, assetId } = entry.data;

        try {
            const sysUtx = await getSysContext({ orgId });
            const asset = await assetDao.get(sysUtx, assetId);

            // ... processing logic ...

            // Publish result
            await assetTextQueue.add({ type: 'AssetText', orgId, assetId });
            await jobQueue.done(entry);
        } catch (ex) {
            const msg = `ERROR - audio-texter - ${ex}`;
            await jobQueue.fail(entry, new Error(msg));
        }
    }
}
```


## 3. Configuration & Build

### 3.1. TypeScript Configuration (`tsconfig.json`)

**Best Practices:**
*   **Path Mapping:** Use aliased imports (`#common/*`, `#shared/*`) to avoid deep relative paths (e.g., `../../../_common`).
*   **Source/Output:** Separate `rootDir` (project root) from `baseUrl` (service source) to allow shared code compilation.
*   **Strict Mode:** Enable `"strict": true` and `"forceConsistentCasingInFileNames": true`.

**Example `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "useDefineForClassFields": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "../../",
    "baseUrl": "./src/",
    "paths": {
      "#common/*": ["../../_common/src/*"],
      "#shared/*": ["../../../shared/src/*"]
    },
    "sourceMap": true
  },
  "include": ["./src/**/*.ts", "./test/**/*.ts"],
  "exclude": ["node_modules", ".rpt2_cache"]
}
```



### 3.2. Package Management (`package.json`)

**Dependencies:**
*   **Runtime:** `cloud-bucket`, `execa`, `knex`, `pg`, `redstream`, `uuid`, `moment`.
*   **Internal:** Shared modules aliased via imports (e.g., `#common/conf`).
*   **Development:** `nodemon` for hot-reloading container images.

**Script Mapping:**
*   `npm start`: Runs the main entry point.
*   `npm run dstart`: Runs with `--inspect` for debugging.

**Example `package.json`:**
```json
{
  "name": "service-name",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/services/service-name/src/start.js",
  "imports": {
    "#common/*": "./dist/services/_common/src/*",
    "#shared/*": "./dist/shared/src/*"
  },
  "scripts": {
    "start": "node dist/services/service-name/src/start",
    "dstart": "node --inspect dist/services/service-name/src/start"
  },
  "dependencies": {
    "cloud-bucket": "^0.5.0",
    "execa": "^9.6.1",
    "knex": "^3.1.0",
    "nodemon": "^3.1.11",
    "pg": "^8.17.2",
    "redstream": "^0.3.0",
    "utils-min": "^0.2.4",
    "uuid": "^13.0.0",
    "@aws-sdk/client-s3": "^3.980.0",
    "openai": "^4.83.0"
  }
}
```



## 4. Containerization (`Dockerfile` & `entrypoint.sh`)

### 4.1. Dockerfile Strategy

**Base Image:** Use the appropriate base image based on service requirements.
*   If the service requires FFmpeg (e.g., for video/audio processing), use `britesnow/base-media:<tag>`.
*   Otherwise, use `britesnow/base-node:<tag>`.

Both images include Node.js, but `base-media` is larger as it includes additional asset processing tools.

**Example Dockerfile for services requiring FFmpeg:**
```dockerfile
FROM britesnow/base-media:25-11-30

RUN mkdir /service
WORKDIR /service

COPY package.json ./
RUN npm install
COPY . .

ENTRYPOINT [ "/bin/bash", "-c", "source ~/.bashrc && /service/entrypoint.sh ${@}", "--" ]
```

**Example Dockerfile for services not requiring FFmpeg:**
```dockerfile
FROM britesnow/base-node:25-11-30

RUN mkdir /service
WORKDIR /service

COPY package.json ./
RUN npm install
COPY . .

ENTRYPOINT [ "/bin/bash", "-c", "source ~/.bashrc && /service/entrypoint.sh ${@}", "--" ]
```

**Build Steps:**
1.  Create working directory.
2.  Copy `package.json` and install dependencies (`npm install`).
3.  Copy the rest of the source code.

**Entrypoint:** `/bin/bash -c` to allow shell logic for run modes.

**Example `Dockerfile`:**
```dockerfile
FROM britesnow/base-media:25-11-30

RUN mkdir /service
WORKDIR /service

COPY package.json ./
RUN npm install
COPY . .

ENTRYPOINT [ "/bin/bash", "-c", "source ~/.bashrc && /service/entrypoint.sh ${@}", "--" ]
```

### 4.2. Entrypoint Logic (`entrypoint.sh`)

The `entrypoint.sh` script handles different execution modes based on the `RUN_MODE` environment variable.

**Modes:**
*   **`NORMAL`**: Standard production run. `npm start`.
*   **`DEBUG_INSPECT`**: Runs Node with `--inspect` for debugging.
*   **`DEBUG_DEMON`**: Runs with `nodemon` for hot-reloading. Ignores `dist`, `test`, `src` changes. Restart is triggered via a separate signal mechanism (e.g., touching a specific file).
*   **`DEBUG_DEMON_INSPECT`**: Combines Nodemon and Inspector.

**Example `entrypoint.sh`:**
```bash
#!/bin/bash

# Normal mode
normal() {
  echo "run mode: NORMAL"
  npm start
}

# Debug with inspect
debug_inspect() {
  echo "run mode: DEBUG_INSPECT"
  npm run dstart
}

# Daemon mode (Hot Reload)
# We ignore changes in src/dist/test and rely on external triggers or nodemon config
debug_demon() {
  echo "run mode: DEBUG_DEMON"
  /service/node_modules/.bin/nodemon --ignore 'dist/*' --ignore 'test/*' --ignore 'src/*' dist/services/service-name/src/start
}

# Daemon mode with inspect
debug_demon_inspect() {
  echo "run mode: DEBUG_DEMON_INSPECT"
  /service/node_modules/.bin/nodemon --inspect --ignore 'dist/*' --ignore 'test/*' --ignore 'src/*' dist/services/service-name/src/start
}

case "$RUN_MODE" in
        DEBUG_INSPECT) debug_inspect ;;
          DEBUG_DEMON) debug_demon ;;
  DEBUG_DEMON_INSPECT) debug_demon_inspect ;;
                    *) normal ;;
esac
```

### 4.3. File Permissions

The `entrypoint.sh` script must have executable permissions to run correctly in the container. Ensure the script has `755` permissions (owner: read/write/execute, group/others: read/execute).

**Set permissions:**
```bash
chmod 755 services/audio-texter/entrypoint.sh
```

If the script does not have executable permissions, the container will fail to start with a permission denied error.



## 5. Kubernetes Deployment (`k8s/dev/*.yaml`)

### 5.1. Configuration Management (`kdd.yaml`)

Use `kdd.yaml` to inject variables into the K8s manifests dynamically, specifically the application version (`__version__`).

**Structure:**
*   `vars`: Extract version from `package.json`.
*   `overlays`: Inject version into `image_tag` and file paths.

**Example `kdd.yaml` Snippet:**
```yaml
vars:
  - from_file: package.json
    extract: ["__version__"]

overlays:
  - .prod/kdd-prod.yaml
  - .custom-dev.yaml

blocks:
  - name: service-name
    dependencies: [_common]
```

### 5.2. Deployment Manifest (`k8s/dev/service-name.yaml`)

**Metadata:**
*   `apiVersion: apps/v1`
*   `kind: Deployment`
*   `name`: `cstar-service-name-dep`
*   `labels`: Include `run: cstar-service-name` for identification.

**Spec:**
*   `replicas: 1`
*   **Selector:** `matchLabels: { run: cstar-service-name }`

**Template (Container):**
*   **Image:** `localhost:5000/cstar-service-name:{{image_tag}}` (Using local registry for dev).
*   **Env:** `service_name: service-name` (Used by internal code to identify itself, if necessary).
*   **Restart Policy:**
    *   Development: `restartPolicy: Always` (Facilitates `nodemon` and imassette restarts).
    *   Production: `restartPolicy: OnFailure`.

**Volumes (Development Only):**
*   Mount `src` to `/service/src`: Allows mapping local source code into the container for `nodemon` (if image doesn't contain it).
*   Mount `dist` to `/service/dist`: Allows compiled output mapping.
*   *Note:* In production builds, the image is baked (includes `dist`), and these mounts are removed.

**Example `k8s/dev/vid-init.yaml`:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cstar-vid-init-dep
  namespace: default
  labels:
    run: cstar-vid-init
spec:
  replicas: 1
  selector:
    matchLabels:
      run: cstar-vid-init
  template:
    metadata:
      labels:
        run: cstar-vid-init
    spec:
      volumes:
        # Dev only: Allow local code mapping
        - name: cstar-vid-init-src
          hostPath:
            path: '{{dir_abs}}/services/vid-init/src'
            type: Directory
        - name: cstar-vid-init-dist
          hostPath:
            path: '{{dir_abs}}/services/vid-init/dist'
            type: Directory
      containers:
        - name: cstar-vid-init-ctn
          image: "localhost:5000/cstar-vid-init:{{image_tag}}"
          imagePullPolicy: Always
          envFrom:
            - configMapRef:
                name: cstar-config
            - secretRef:
                name: cstar-secret
          env:
            - name: service_name
              value: vid-init                    
          volumeMounts:
            - mountPath: /service/src
              name: cstar-vid-init-src
            - mountPath: /service/dist
              name: cstar-vid-init-dist
      restartPolicy: Always
```
