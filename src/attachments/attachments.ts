import { AttachmentsResponse, Photo, VideosIdentificationData, Attachment, Video, Message, PhotosDataForDownlod, VideoFiles, responseVideo, PhotoData, AttachmenInfo } from '../types';
import cliProgress from 'cli-progress';
import { join } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { Core } from '../core';
import { HttpClient } from '../http/http_client';
import { Injectable } from '../di/injectable';
import { getJsonFromFile, isPhoto, isVideo } from '../utils/get-json-from-file';
import { at, pick } from 'lodash';
import { getPhotoBestResolutionLink, getVideoBestResolutionLink } from '../utils/attachments';
import logUpdate from 'log-update';
import { FORMAT_PROGRESS_BAR } from '../common/constants';

@Injectable()
export class Attachments {

  constructor(
    private core: Core,
    private http: HttpClient
  ) { }

  async getVideoIdsFromDialog(dialogId: number): Promise<VideosIdentificationData[]> {
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

  async getVideoObjects(idsList: Array<VideosIdentificationData>): Promise<Video[]> {
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

  async downloadVideoFormDialog(dialogId: number, name: string): Promise<void> {
    const errors: any = [];
    const dir = join('users', name, 'video');
    this.core.createDirectory(dir)

    let videos: Video[] = [];

    const urlList = await this.getVideoIdsFromDialog(dialogId);
    videos = await this.getVideoObjects(urlList);
    videos = videos.filter(v => !v.hasOwnProperty('platform') && v.hasOwnProperty('files'));

    for (let i = 0; i < videos.length; i++) {

      const files = videos[i].files;

      if (files.hasOwnProperty('hls')) { delete files.hls }

      const filename = `${videos[i].owner_id}_${videos[i].id}.mp4`;

      if (existsSync(join(dir, filename))) continue;

      const bestResolutionLink = <keyof VideoFiles>Object.keys(files).pop();

      const url = files[bestResolutionLink];

      const fullPath = join(dir, filename);

      const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      bar.start(100, 0);

      await this.core.downloadFile(fullPath, url, (c, l) => {
        bar.update(Math.floor(c / (l / 100)));
      });
      bar.stop();

      console.log(`\n Download ${i + 1} from ${videos.length}`);


    }

    writeFileSync(join(dir, 'errors.json'), JSON.stringify(errors));
  }

  public async downloadAttachmentsFromDialog(peerId): Promise<void> {
    const directory = join('users', `${peerId}`);


    if (!existsSync(join(directory, 'messages.json'))) {
      throw new Error('Для этого пользователя диалог не загружен!');
    }

    try {
      const messages = getJsonFromFile(join(directory, 'messages.json'));
      const result = this.getAttachmentUrlsFromMessages(messages);

      const dir = join('users', `${peerId}`, 'attachments');
      await this.attachmentDownloader(result, dir);
      // writeFileSync(join('users', `${peerId}`, 'test.json'), JSON.stringify(result));
    } catch {
      throw new Error('Ошибка чтения диалога!');
    }
  }

  private async attachmentDownloader(attachments: AttachmenInfo[], dir: string): Promise<void> {
    this.core.createDirectory(dir);

    const bar = new cliProgress.SingleBar({
      format: FORMAT_PROGRESS_BAR,
    }, cliProgress.Presets.shades_classic);

    console.log('Downloading attachemnts:');
    let loaded = 0;
    bar.start(100, 0, { loaded, totalItems: attachments.length });
    for (let attachment of attachments) {
      bar.update(0, { loaded });

      const filename = `${attachment.owner_id}_${attachment.id}.${attachment.type === 'video' ? 'mp4' : 'jpg'}`;
      if (existsSync(join(dir, filename))) {
        loaded++;
        continue
      };
      await this.core.downloadFile(join(dir, `${filename}`), attachment.url, (c, l) => {
        bar.update(Math.floor(c / (l / 100)));
      });
      loaded++;
    }
  }


  private getAttachmentUrlsFromMessages(messages: Message[]): AttachmenInfo[] {
    return messages.map(message => {
      const result: AttachmenInfo[] = [];

      if (message.attachments) {
        result.push(...this.getAttachmensFromMessage(message.attachments));
      }
      if (message.fwd_messages) {
        result.push(...this.getAttachmentUrlsFromMessages(message.fwd_messages));
      }
      return result;

    }).flat();
  }

  private getAttachmensFromMessage(attachments: Attachment<any>[]): AttachmenInfo[] {
    return attachments.map(attachment => {

      if (isPhoto(attachment)) {

        return {
          ...pick(attachment.photo, 'id', 'owner_id'),
          url: getPhotoBestResolutionLink(attachment.photo),
          type: 'photo'
        };
      }

      if (isVideo(attachment)) {
        if (!attachment.video.files) return;

        return {
          ...pick(attachment.video, 'id', 'owner_id'),
          url: getVideoBestResolutionLink(attachment.video.files),
          type: 'video'
        };
      }

    }).filter(item => item && item.url !== undefined);

  }




  private downloadPhotoFromMessagesList(messages: Message[]) {

    const urls = this.getPhotosUrlFromMessagesArr(messages);
    this.downloadPhotos(urls, '');
  }


  private getPhotosUrlFromMessagesArr(messages: Message[]): PhotosDataForDownlod[] {
    const m = messages;
    const urls: PhotosDataForDownlod[] = [];
    for (let i = 0; i < m.length; i++) {
      this.getUrlsFromFwd([m[i]], urls);
      console.log(`Проверено ${i + 1} из ${m.length} сообщений: ${urls.length}`)
    }
    return urls;
  }

  private getUrlsFromFwd(fwd: Message[], urls: Array<any>): void {
    fwd.forEach(e => {
      if (e.attachments) {
        let photos = e.attachments.filter(res => res.type == 'photo').map((r => r.photo));
        let ss = photos.map((r: Photo) => {
          return {
            id: r.id,
            url: getPhotoBestResolutionLink(r)
          };
        });
        urls.push(...ss);
      }
      if (e.fwd_messages) { this.getUrlsFromFwd(e.fwd_messages, urls); }
    });
  }

  public async downloadPhotosFromDialog(dialogId: number, path: string): Promise<void> {
    const urls = await this.getPhotosUrl(dialogId);
    await this.downloadPhotos(urls, path);
  }


  private async downloadPhotos(urls: PhotosDataForDownlod[], dir: string): Promise<void> {

    const errors = [];
    const directory = join('users', dir, 'photo');
    this.core.createDirectory(directory);

    for (let i = 0; i < urls.length; i++) {
      try {
        const fullPath = join(directory, `${urls[i].id}.jpg`);
        await this.core.downloadFile(fullPath, urls[i].url);
        console.log(`Complete ${i + 1} from ${urls.length}`);
      } catch (e) {
        errors.push(urls[i]);
      }
    }
    writeFileSync(join(directory, 'errors.json'), JSON.stringify(errors));

    if (errors.length) { console.warn(`Errors: ${errors.length}`) }
  }




  private async getPhotosUrl(dialogId: number): Promise<PhotosDataForDownlod[]> {
    const attachmentUrls = [];

    for await (let photos of this.photoUrlLoader(dialogId)) {
      attachmentUrls.push(...photos);
      console.log(`Found: ${attachmentUrls.length}`);
    }

    return attachmentUrls;
  }

  private async *photoUrlLoader(dialogId: number): AsyncIterable<PhotoData[]> {

    const params = {
      start_from: '0',
      peer_id: dialogId,
      media_type: 'photo',
      count: 200,
    };

    const request = this.http.buildRequest()
      .section('messages')
      .method('getHistoryAttachments')

    while (true) {

      const result = await request.params(params)
        .send<AttachmentsResponse<Photo>>(200);

      const photos = result.response.items.map(i => {
        return {
          messageId: i.message_id,
          id: i.attachment.photo.id,
          url: getPhotoBestResolutionLink(i.attachment.photo)
        };
      });

      params.start_from = result.response.next_from;

      yield photos;

      if (photos.length < 200) break;

    }
  }


}