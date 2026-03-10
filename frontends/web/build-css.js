import chokidar from 'chokidar';
import { bundle } from 'lightningcss';

// Configuration
const ENTRY_FILE = './css/main.css';
const OUTPUT_FILE = '../../services/web-server/web-folder/css/all-bundle.css';
const WATCH_GLOB = './css/**/*.css';

// Build function
async function build() {
  console.log('Building CSS...');
  try {
    await bundle({
      filename: ENTRY_FILE,
      outputFile: OUTPUT_FILE,
      
      // Set this to your project root (where package.json and node_modules are located)
      // This allows lightningcss to resolve imports like '@dom-native/...'
      projectRoot: process.cwd(), 
      // -------------------------------

      minify: true,
      cssModules: true,
      drafts: { nesting: true },
      // targets: { browsers: "> 0.25%, not dead" }
    });
    console.log(`Built: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('Build failed:', error);
  }
}

// Run build immediately
build();

// Check if -w flag is present
const isWatch = process.argv.includes('-w');

if (isWatch) {
  console.log('Watching for changes...');
  
  // Initialize watcher
  const watcher = chokidar.watch(WATCH_GLOB);

  // Listen for changes
  watcher.on('change', (path) => {
    console.log(`File changed: ${path}`);
    build();
  });

  // Listen for new files (optional)
  watcher.on('add', (path) => {
    console.log(`File added: ${path}`);
    build();
  });
}