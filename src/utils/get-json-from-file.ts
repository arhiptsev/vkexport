import { readFileSync } from "fs";
import { Attachment, Photo, Video } from "../types";

export function getJsonFromFile(path: string): any {
  return JSON.parse(readFileSync(path).toString());
}

export function isVideo(key: Attachment<any>): key is Attachment<Video> {
  return key.hasOwnProperty('type') && key.type === 'video';
}

export function isPhoto(key: Attachment<any>): key is Attachment<Photo> {
  return key.hasOwnProperty('type') && key.type === 'photo';
}