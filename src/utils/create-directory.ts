import { existsSync, mkdirSync } from "fs";

export function createDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }