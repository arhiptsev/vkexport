import { PhotoSize } from "@prisma/client";
import { pick } from "lodash";
import { Photo, PhotoSizes, VideoFiles } from "../types";
import { VideoQuality } from "./types";

export const getOnlyQuality: (files: VideoFiles) => VideoQuality = files =>
    pick(files, 'mp4_240', 'mp4_360', 'mp4_480', 'mp4_720');

export function getVideoBestResolutionLink(files: VideoFiles): string {

    const sizePriority = ['mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
    for (let size of sizePriority) {
        if (files[size]) return files[size];
    }
}

export function getPhotoBestResolutionLink(photo: Photo): string {
    return getMaxSize(photo.sizes);
}

export function getMaxSize(sizes: Partial<PhotoSize>[]): string {
    let link = "";
    const sizePriority = ["w", "z", "y", "x", "m", "s"];
    for (let size of sizePriority) {
        if (sizes.find(i => i.type == size) !== undefined) {
            link = sizes.find(i => i.type == size).url;
            break;
        }
    }
    return link;
}
