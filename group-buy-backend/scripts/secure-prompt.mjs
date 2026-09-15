export function promptSecret(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("This command requires an interactive terminal");
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = process.stdin.isRaw;
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
    };
    const onData = (buffer) => {
      const input = buffer.toString("utf8");
      if (input === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        reject(new Error("Cancelled"));
        return;
      }
      if (input === "\r" || input === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (input === "\u007f" || input === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (!/[\r\n]/.test(input)) value += input;
    };
    process.stdin.on("data", onData);
  });
}
