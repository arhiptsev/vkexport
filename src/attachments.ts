import { Messages } from './messages';
import { AttachmentsResponse, Photo, ApiResponse, VideosIdentificationData, Attachment, Video, Message, MessageAttachement, PhotosDataForDownlod, VideoFiles, responseVideo } from './types';
import { Response } from "node-fetch";
import cliProgress from 'cli-progress';

export class Attachments extends Messages {



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
      const requestUrl = this.buildRequestUrl('messages', 'getHistoryAttachments', params);
      let res = await this.sendRequestWithTimeout<AttachmentsResponse<Photo>>(requestUrl, 300);

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
    const errors = [];
    const urlMethod = 'https://api.vk.com/method/video.get';
    let offset = 0;

    while (true) {

      let idsListPart = idsList.slice(offset, idsList.length - 1);
      if (idsListPart.length) { break; }
      if (idsListPart.length > 50) { idsListPart = idsListPart.slice(0, 49); }

      const idsString = idsListPart
        .map(i => `${i.owner_id}_${i.id}_${i.access_key}`)
        .join(',');

      const params = {
        videos: idsString,
        count: 200
      }
      const requestUrl = this.buildRequestUrl('video', 'get', params);

      let response = await this.sendRequestWithTimeout<responseVideo>(requestUrl, 500);
      videos.push(...response.response.items);
      offset = offset + 50;
      console.log(`Get ${videos.length} of ${idsList.length}`);
    }

    return videos;
  }

  async downloadVideoFormDialog(dialogId: number, name: string): Promise<void> {
    const errors: any = [];
    const dir = this.path.join('users', name, 'video');
    let videos: Video[] = [];

    const urlList = await this.getVideoIdsFromDialog(dialogId);
    videos = await this.getVideoObjects(urlList);
    videos = videos.filter(v => !v.hasOwnProperty('platform') && v.hasOwnProperty('files'));

    for (let i = 0; i < videos.length; i++) {

      if (videos[i].files.hasOwnProperty('hls')) { delete videos[i].files.hls }
      const filename = videos[i].owner_id + '_' + videos[i].id;
      if (this.fs.existsSync(this.path.join(dir, filename + '.mp4'))) continue;
      const bestResolutionLink: keyof VideoFiles = <keyof VideoFiles>Object.keys(videos[i].files).pop();
      const url = videos[i].files[bestResolutionLink];
      const fullPath = `${dir}/${filename}.mp4`;
      const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      bar.start(100, 0);

      await this.downloadFile(fullPath, url, (c, l) => {
        bar.update(Math.floor(c / (l / 100)));
      });
      bar.stop();

      console.log(`\n Download ${i + 1} from ${videos.length}`);


    }

    this.fs.writeFileSync(this.path.join(dir, 'errors.json'), JSON.stringify(errors));
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
            url: this.getPhotoBestResolutionLink(r)
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


  private async downloadPhotos(urls: PhotosDataForDownlod[], path: string): Promise<void> {
    const errors = [];
    for (let i = 0; i < urls.length; i++) {
      try {
        const fullPath = `./users/${path}/photo/${urls[i].id}.jpg`;
        await this.downloadFile(fullPath, urls[i].url);
        console.log(`Complete ${i + 1} from ${urls.length}`);
      } catch (e) {
        errors.push(urls[i]);
      }
    }
    this.fs.writeFileSync(`./users/${path}/photo/errors.json`, JSON.stringify(errors));

    if (errors.length) { console.warn(`Errors: ${errors.length}`) }
  }



  private async getPhotosUrl(dialogId: number): Promise<PhotosDataForDownlod[]> {
    const attachmentUrls = [];
    const params = {
      offset: '0',
      peer_id: dialogId,
      media_type: 'photo',
      count: 200,
    };
    while (true) {

      const requestUrl = this.buildRequestUrl('messages', 'getHistoryAttachments')
      let result = await this.sendRequestWithTimeout<AttachmentsResponse<Photo>>(requestUrl, 200);
      const photos = result.response.items.map(i => {
        return {
          messageId: i.message_id,
          id: i.attachment.photo.id,
          url: this.getPhotoBestResolutionLink(i.attachment.photo)
        };
      });

      if (photos.length == 0) break;

      params.offset = result.response.next_from;

      attachmentUrls.push(...photos);

      console.log(`Found: ${attachmentUrls.length}`)
    }
    return attachmentUrls;

  }

  private getPhotoBestResolutionLink(photo: Photo): string {
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

}