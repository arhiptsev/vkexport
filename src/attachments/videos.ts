import {
  AttachmentsResponse,
  Photo,
  VideosIdentificationData,
  Video,
  responseVideo,
  AttachmenInfo
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { Core } from '../core';
import { Injectable } from '../di/injectable';
import { getVideoBestResolutionLink, getVideoBestResolutionLinkWithCheck } from '../utils/attachments';
import { AttachmentDownloader } from './attachmentDownloader';
import { PrismaClient } from '@prisma/client';
import { FileDownloader } from './FileDownloader';
import fetch, { Response } from 'node-fetch';
import { existsSync } from 'fs';
import { isObject } from 'lodash';


@Injectable()
export class VideoAttachemnts {

  constructor(
    private core: Core,
    private storage: PrismaClient,
    private fileDownloader: FileDownloader
  ) { }

  public async downloadVideoFromDB(): Promise<void> {
    const videos = await this.storage.videoFile.findMany({
      where: {
        file: {
          not: null
        }
      },
      include: { Video: true }
    });


    const downloader = this.fileDownloader.createDownloader(videos.length);
    const errors = [];

    for (const { Video: { id, access_key, owner_id }, export_id, file } of videos) {
      if (file && existsSync(join(__dirname, '..', '..', 'videos', file))) {
        continue;
      }

      const res = await this.getVideoObject({ id, owner_id, access_key });
      if (!res || !res.files) continue;
      const { files } = res;
      console.log(files);
      const url = await getVideoBestResolutionLinkWithCheck(files);
      if (!url) { continue; }

      try {
        const filename = `${uuidv4()}.mp4`;
        await downloader.next({ path: join(__dirname, '..', '..', 'videos', filename), url });
        await this.storage.videoFile.update({
          where: {
            export_id
          },
          data: {
            file: filename
          }
        });
      } catch (e) {
        console.log(e);
        errors.push(url);
      }
    }

  }


  private async getVideoIdsFromDialog(dialogId: number): Promise<VideosIdentificationData[]> {
    const accessKeysList = [];
    const params = {
      offset: 0,
      peer_id: dialogId,
      start_from: '0',
      media_type: 'video',
      count: 200,
    }

    while (true) {
      const requestUrl = this.core.buildRequestUrl('messages', 'getHistoryAttachments', params);
      let res = await this.core.sendRequestWithTimeout<AttachmentsResponse<Photo>>(requestUrl, 300);

      if (res.response.items.length == 0) break;
      accessKeysList.push(...res.response.items.map(v => {
        return {
          id: v.attachment.video.id,
          owner_id: v.attachment.video.owner_id,
          access_key: v.attachment.video.access_key,
        }
      }));
      params.start_from = res.response.next_from;
    }
    console.log(`Found ${accessKeysList.length} video.`);
    return accessKeysList;

  }

  private async getVideoObject({ id, owner_id, access_key }: VideosIdentificationData): Promise<Video> {
    const idsString = `${owner_id}_${id}_${access_key}`;
    const params = {
      videos: idsString,
      count: 200
    }
    const requestUrl = this.core.buildRequestUrl('video', 'get', params);

    const { response } = await this.core.sendRequestWithTimeout<responseVideo>(requestUrl, 500);
    return response.items[0];
  }


}