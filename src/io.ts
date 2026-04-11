import { readFileSync, writeFileSync } from "node:fs";

/**
 * Read a file argument. The special argument "-" means read from stdin.
 * Returns bytes so binary inputs round-trip untouched.
 */
export async function readInput(pathOrDash: string): Promise<Uint8Array> {
  if (pathOrDash === "-") return readStdin();
  return new Uint8Array(readFileSync(pathOrDash));
}

/** Read a text file or stdin (for the "-" sentinel). */
export async function readText(pathOrDash: string): Promise<string> {
  if (pathOrDash === "-") {
    const bytes = await readStdin();
    return new TextDecoder().decode(bytes);
  }
  return readFileSync(pathOrDash, "utf8");
}

export async function readStdin(): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * Write binary output either to a file (if `outPath` is provided) or to
 * stdout. Explicitly unhooks any TTY formatting — stdout is a raw pipe.
 */
export function writeBinaryOutput(bytes: Uint8Array, outPath: string | undefined): void {
  if (outPath) {
    writeFileSync(outPath, bytes);
    return;
  }
  // Never write binary to a TTY — that corrupts the terminal. Instead, warn
  // and exit with a usage error (exit code 1).
  if (process.stdout.isTTY) {
    process.stderr.write(
      "error: refusing to write binary output to a terminal; use -o <file> or pipe stdout.\n",
    );
    process.exit(1);
  }
  process.stdout.write(bytes);
}

/** Write a text string to a file or stdout. */
export function writeTextOutput(text: string, outPath: string | undefined): void {
  if (outPath) {
    writeFileSync(outPath, text, "utf8");
    return;
  }
  process.stdout.write(text);
  if (!text.endsWith("\n")) process.stdout.write("\n");
}
