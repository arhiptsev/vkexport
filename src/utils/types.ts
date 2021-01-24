import { VideoFiles } from "../types";
export type VideoQuality = Pick<VideoFiles, 'mp4_240' | 'mp4_360' | 'mp4_480' | 'mp4_720'>; 