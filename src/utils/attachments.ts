import { pick } from "lodash";
import { Photo, VideoFiles } from "../types";
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
    let link = "";
    const sizePriority = ["w", "z", "y", "x", "m", "s"];
    for (let size of sizePriority) {
        if (photo.sizes.find(i => i.type == size) !== undefined) {
            link = photo.sizes.find(i => i.type == size).url;
            break;
        }
    }
    return link;
}
