export function parseOptions(src: string): Record<string, string> {
  const options: Record<string, string> = {};
  src.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+)\s*$/);
    if (match) {
      options[match[1].trim()] = match[2].trim();
    }
  });
  return options;
}

