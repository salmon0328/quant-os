/**
 * Lazy Pyodide loader — Python (with NumPy and pandas) in the browser.
 *
 * The runtime is ~10MB, so it is loaded on first use only, the same way the
 * flashcard deck is. Nothing about Learn depends on it until you press Run.
 */

const PYODIDE_VERSION = '0.28.3';
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export interface PyodideRuntime {
  runPythonAsync(code: string): Promise<unknown>;
  loadPackage(names: string | string[]): Promise<void>;
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
  globals: { get(name: string): unknown };
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideRuntime>;
  }
}

let runtime: Promise<PyodideRuntime> | null = null;
/** Packages already loaded into the running interpreter. */
const loaded = new Set<string>();

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load the Python runtime — check your connection.'));
    document.head.appendChild(el);
  });
}

/** Resolves the shared interpreter, booting it on first call. */
export function getPyodide(): Promise<PyodideRuntime> {
  runtime ??= (async () => {
    await injectScript(`${CDN}pyodide.js`);
    if (!window.loadPyodide) throw new Error('The Python runtime failed to initialise.');
    return window.loadPyodide({ indexURL: CDN });
  })().catch((err) => {
    // Let a later attempt retry rather than caching the failure forever.
    runtime = null;
    throw err;
  });
  return runtime;
}

export async function ensurePackages(py: PyodideRuntime, packages: string[]): Promise<void> {
  const missing = packages.filter((p) => !loaded.has(p));
  if (missing.length === 0) return;
  await py.loadPackage(missing);
  missing.forEach((p) => loaded.add(p));
}

/** Guesses which scientific packages a snippet needs, so Run stays one click. */
export function packagesFor(code: string): string[] {
  const wanted: string[] = [];
  if (/\bimport\s+numpy|from\s+numpy\b|\bnp\./.test(code)) wanted.push('numpy');
  if (/\bimport\s+pandas|from\s+pandas\b|\bpd\./.test(code)) wanted.push('pandas');
  if (/\bimport\s+scipy|from\s+scipy\b/.test(code)) wanted.push('scipy');
  return wanted;
}

export interface RunResult {
  ok: boolean;
  /** Everything the snippet printed. */
  output: string;
  /** Present when the snippet raised. */
  error?: string;
}

/**
 * Runs `code`, optionally followed by `tests`.
 *
 * Tests are appended rather than run separately so they see the user's
 * definitions, and their output is kept out of the visible stdout — a passing
 * assert should be silent.
 */
export async function runPython(code: string, tests?: string): Promise<RunResult> {
  let py: PyodideRuntime;
  try {
    py = await getPyodide();
  } catch (err) {
    return { ok: false, output: '', error: err instanceof Error ? err.message : 'Python runtime unavailable.' };
  }

  const chunks: string[] = [];
  py.setStdout({ batched: (s) => chunks.push(s) });
  py.setStderr({ batched: (s) => chunks.push(s) });

  try {
    await ensurePackages(py, packagesFor(code + (tests ?? '')));
  } catch {
    return { ok: false, output: '', error: 'Could not load the required Python packages.' };
  }

  try {
    await py.runPythonAsync(code);
  } catch (err) {
    return { ok: false, output: chunks.join('\n'), error: cleanTraceback(err) };
  }

  if (tests) {
    try {
      await py.runPythonAsync(tests);
    } catch (err) {
      return { ok: false, output: chunks.join('\n'), error: cleanTraceback(err) };
    }
  }

  return { ok: true, output: chunks.join('\n') };
}

/**
 * Pyodide tracebacks carry frames from its own loader, which are noise to
 * someone debugging their own five-line function.
 */
function cleanTraceback(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lines = raw.split('\n').filter((l) => !l.includes('/lib/python3') && !l.includes('pyodide.asm'));
  const start = lines.findIndex((l) => l.startsWith('Traceback'));
  return (start >= 0 ? lines.slice(start) : lines).join('\n').trim() || raw;
}
