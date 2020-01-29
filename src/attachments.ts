import { Messages } from './messages';
import { AttachmentsResponse, Photo, ApiResponse, VideosIdentificationData, Attachment, Video, Message, MessageAttachement, PhotosDataForDownlod, VideoFiles, responseVideo } from './types';
import { Response } from "node-fetch";
import cliProgress from 'cli-progress';
export class Attachments extends Messages {

  protected sendRequestWithTimeout<T>(request: string, timeout: number): Promise<ApiResponse<T>> {
    return new Promise<ApiResponse<T>>(resolve =>
      setTimeout(() =>
        this.fetch(request)
          .then((res: Response) => res.json())
          .then(resolve),
        timeout
      ));
  }

  private async downloadFile(
    fullPath: string,
    url: string,
    onProgress?: (current: number, length: number) => void
  ): Promise<any> {
    await new Promise((resolve, reject) => {
      const dl = this.fetch(url)
        .then(res => {
          if (res.ok) {
            let currentLength = 0;
            const fullLength = +res.headers.get('Content-Length');
            res.body.on('data', d => {
              currentLength += d.length;
              !onProgress || onProgress(currentLength, fullLength);
            });
            const stream = this.fs.createWriteStream(fullPath);
            stream.on('finish', resolve);
            res.body.on('error', reject)
            res.body.pipe(stream);
          }
        });
      // dl.on('error', () => { errors.push(videos[i]); bar.stop(); resolve(); });
      // dl.on('progress', (e: any) => bar.update(Math.floor(e.progress)));

    });
  }


  async getVideoIdsFromDialog(dialogId: number): Promise<VideosIdentificationData[]> {
    const accessKeysList = [];
    const urlMethod = 'https://api.vk.com/method/messages.getHistoryAttachments';
    let offset = "0";
    while (true) {
      const fullRequestUrl = urlMethod +
        `?media_type=video&peer_id=${dialogId}&start_from=${offset}&access_token=${this.token}&v=5.101&count=200`;
      let res = await this.sendRequestWithTimeout<AttachmentsResponse<Photo>>(fullRequestUrl, 300);

      if (res.response.items.length == 0) break;
      accessKeysList.push(...res.response.items.map(v => {
        return {
          id: v.attachment.video.id,
          owner_id: v.attachment.video.owner_id,
          access_key: v.attachment.video.access_key,
        }
      }));
      offset = res.response.next_from;
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
      let idsListPart = idsList.slice(offset, offset + 50);
      if (idsListPart.length == 0) {
        idsListPart = idsList.slice(offset, idsList.length);
        if (idsListPart.length == 0) {
          break;
        }
      }
      const ids = idsListPart.map(i => `${i.owner_id}_${i.id}_${i.access_key}`);
      const stringVideos = ids.join(',');
      const fullRequestUrl = urlMethod +
        `?videos=${stringVideos}&access_token=${this.token}&count=200&v=5.103`;
      let response = await this.sendRequestWithTimeout<responseVideo>(fullRequestUrl, 500);
      console.log(response);
      videos.push(...response.response.items.map(i => i) as Video[]);
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
    videos = videos.filter(v => !v.hasOwnProperty('platform') && v.hasOwnProperty('files'))
    for (let i = 0; i < videos.length; i++) {

      if (videos[i].files.hasOwnProperty('hls')) { delete videos[i].files.hls }
      const filename = videos[i].owner_id + '_' + videos[i].id;
      if (this.fs.existsSync(this.path.join(dir, filename + '.mp4'))) continue;
      const bestResolutionLink: keyof VideoFiles = <keyof VideoFiles>Object.keys(videos[i].files).pop();
      const url = videos[i].files[bestResolutionLink];
      const fullPath = `${dir}/${filename}.mp4`;
      console.log(fullPath);
      const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      bar.start(100,0);

      await this.downloadFile(fullPath, url,(c,l)=> {
        bar.update(Math.floor(c/(l/100)));
      });
      bar.stop();
      console.log(`\n Download ${i + 1} from ${videos.length}`);

      // dl.on('error', () => { errors.push(videos[i]); bar.stop(); resolve(); });
      // dl.on('progress', (e: any) => bar.update(Math.floor(e.progress)));


    }

    this.fs.writeFileSync(this.path.join(dir, 'errors.json'), JSON.stringify(errors));
  }



  getUrlsFromFwd(fwd: Message[], urls: Array<any>) {
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


  downloadPhotoFromMessagesList(messages: Message[]) {

    const urls = this.getPhotosUrlFromMessagesArr(messages);
    this.downloadAttachments(urls, '');
  }


  getPhotosUrlFromMessagesArr(messages: Message[]): PhotosDataForDownlod[] {
    const m = messages;
    const urls: PhotosDataForDownlod[] = [];
    for (let i = 0; i < m.length; i++) {
      this.getUrlsFromFwd([m[i]], urls);
      console.log(`Проверено ${i + 1} из ${m.length} сообщений: ${urls.length}`)
    }
    return urls;
  }


  async downloadPhotosFromDialog(dialogId: number, path: string) {
    const urls = await this.getAttachmentsUrl(dialogId);
    await this.downloadAttachments(urls, path);
  }


  async downloadAttachments(urls: PhotosDataForDownlod[], path: string) {
    const errors = [];
    for (let i = 0; i < urls.length; i++) {
      try {
        await new Promise((resolve, reject) => {
          this.fetch(urls[i].url).then(res => {
            if (res.ok) {
              const stream = this.fs.createWriteStream(`./users/${path}/photo/${urls[i].id}.jpg`);
              res.body.pipe(stream);
              res.body.on('error', reject);
              stream.on('finish', resolve)
            }
          });

        }).then(() => console.log(`Complete ${i + 1} from ${urls.length}`))

      } catch (e) {
        errors.push(urls[i]);
      }
    }
    this.fs.writeFileSync(`./users/${path}/photo/errors.json`, JSON.stringify(errors));
    if (errors.length) { console.warn(`Errors: ${errors.length}`) }
  }



  async getAttachmentsUrl(dialogId: number): Promise<PhotosDataForDownlod[]> {
    const attachmentUrls = [];
    let offset = "0";
    const urlMethod = 'https://api.vk.com/method/messages.getHistoryAttachments';
    while (true) {
      const fullRequestUrl = urlMethod +
        `?media_type=photo&peer_id=${dialogId}&start_from=${offset}&access_token=${this.token}&v=5.101&count=200`;

      let result = await this.sendRequestWithTimeout<AttachmentsResponse<Photo>>(fullRequestUrl, 200);
      const photos = result.response.items.map(i => {
        return {
          messageId: i.message_id,
          id: i.attachment.photo.id,
          url: this.getPhotoBestResolutionLink(i.attachment.photo)
        };
      });
      if (photos.length == 0) break;
      offset = result.response.next_from;
      attachmentUrls.push(...photos);
      console.log(`Found: ${attachmentUrls.length}`)
    }
    return attachmentUrls;

  }

  getPhotoBestResolutionLink(photo: Photo) {
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