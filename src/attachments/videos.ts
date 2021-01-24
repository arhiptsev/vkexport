import {
  AttachmentsResponse,
  Photo,
  VideosIdentificationData,
  Video,
  responseVideo,
  AttachmenInfo
} from '../types';
import { join } from 'path';
import { Core } from '../core';
import { Injectable } from '../di/injectable';
import { pick } from 'lodash';
import { getVideoBestResolutionLink } from '../utils/attachments';
import { AttachmentDownloader } from './attachmentDownloader';

@Injectable()
export class VideoAttachemnts {

  constructor(
    private core: Core,
    private attachmentDownloader: AttachmentDownloader
  ) { }

  public async downloadVideoFormDialog(dialogId: number): Promise<void> {
    const dir = join('users', `${dialogId}`, 'video');

    let videos: Video[] = [];

    const urlList = await this.getVideoIdsFromDialog(dialogId);
    videos = await this.getVideoObjects(urlList);

    
    const attachments = videos.map<AttachmenInfo>(video => ({
      ...pick(video, 'id', 'owner_id'),
      url: getVideoBestResolutionLink(video.files),
      type: 'video'
    })).filter(item => item && item.url);
    
    await this.attachmentDownloader.download(attachments, dir);

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

  private async getVideoObjects(idsList: Array<VideosIdentificationData>): Promise<Video[]> {
    const videos: Video[] = [];
    let offset = 0;

    while (true) {
      let idsListPart = idsList.slice(offset, idsList.length - 1);
      if (!idsListPart.length) { break; }
      if (idsListPart.length > 50) { idsListPart = idsListPart.slice(0, 49); }
      const idsString = idsListPart
        .map(i => `${i.owner_id}_${i.id}_${i.access_key}`)
        .join(',');

      const params = {
        videos: idsString,
        count: 200
      }
      const requestUrl = this.core.buildRequestUrl('video', 'get', params);

      let response = await this.core.sendRequestWithTimeout<responseVideo>(requestUrl, 500);

      videos.push(...response.response.items);
      offset = offset + 50;
      console.log(`Get ${videos.length} of ${idsList.length}`);
    }

    return videos;
  }




}