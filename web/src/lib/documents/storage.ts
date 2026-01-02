import fs from "fs";
import path from "path";

export function getDocumentsDir() {
  const dir = process.env.DOCUMENTS_DIR || "storage/docs";
  const abs = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}
