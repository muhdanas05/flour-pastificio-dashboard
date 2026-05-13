const fs   = require('fs');
const path = require('path');

// Load .env for local development
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  });
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_ANON_KEY — set them in .env or Netlify dashboard');
  process.exit(1);
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

// Read source files
let html  = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
let   js  = fs.readFileSync(path.join(__dirname, 'app.js'),    'utf8');

// Inject Supabase credentials into JS
js = js
  .replace("'%%SUPABASE_URL%%'", JSON.stringify(url))
  .replace("'%%SUPABASE_KEY%%'", JSON.stringify(key));

// Inline CSS and JS into HTML
html = html
  .replace('<!--STYLES-->', `<style>\n${css}\n</style>`)
  .replace('<!--SCRIPTS-->', `<script>\n${js}\n</script>`);

fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);

console.log('✅  Built dist/index.html');
console.log(`    URL: ${url}`);
console.log(`    Key: ${key.slice(0, 30)}…`);
