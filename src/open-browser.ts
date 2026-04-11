import { spawn } from "node:child_process";

/**
 * Open a URL in the user's default browser. Cross-platform and dependency-free.
 *
 * macOS:   `open <url>`
 * Windows: `start "" <url>` (via cmd.exe so the empty title arg is handled)
 * Linux:   `xdg-open <url>`
 *
 * Returns a promise that resolves when the child process has been spawned
 * (not when the browser has actually rendered the page). Rejects only if the
 * spawn itself fails.
 */
export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const [cmd, args] = commandFor(url);
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    });
    child.once("error", reject);
    // Unref so the parent CLI can exit even if the browser process is still
    // being launched.
    child.unref();
    resolve();
  });
}

function commandFor(url: string): [string, string[]] {
  switch (process.platform) {
    case "darwin":
      return ["open", [url]];
    case "win32":
      // The empty "" is a title placeholder that `start` requires when the
      // first quoted arg might look like a title.
      return ["cmd", ["/c", "start", '""', url]];
    default:
      return ["xdg-open", [url]];
  }
}
