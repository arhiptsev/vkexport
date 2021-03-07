import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pick } from 'lodash';
import { PrismaClient } from '@prisma/client';

import {
  AttachmentsResponse,
  Photo,
  AttachmenInfo
} from '../types';
import { HttpClient } from '../http/http_client';
import { Injectable } from '../di/injectable';
import { getMaxSize, getPhotoBestResolutionLink } from '../utils/attachments';
import { AttachmentDownloader } from './attachmentDownloader';
import { createDirectory } from '../utils/create-directory';
import { FileDownloader } from './FileDownloader';

@Injectable()
export class PhotoAttachments {

  constructor(
    private http: HttpClient,
    private storage: PrismaClient,
    private attachmentDownloader: AttachmentDownloader,
    private fileDownloader: FileDownloader
  ) { }

  public async downloadPhotosFromDialog(dialogId: number): Promise<void> {

    const photos = await this.getPhotoAttachments(dialogId);

    const dir = join(__dirname, '..', '..', dialogId.toString(), 'photos')
    createDirectory(dir)

    await this.attachmentDownloader.download(photos, dir)

    console.log(`Complete!!!`);
  }

  public async downloadAllPhotos(): Promise<void> {

    const photos = await this.storage.photo.findMany({
      include: { sizes: true }
    });

    const filteredPhotos = photos.filter(photo => photo.sizes.every(s => !s.file));

    let count = 0;
    const errors = [];

    const downloader = this.fileDownloader.createDownloader(filteredPhotos.length);

    for (const photo of filteredPhotos) {
      const url = getMaxSize(photo.sizes);
      const { export_id } = photo.sizes.find(size => size.url === url);

      try {
        const filename = `${uuidv4()}.jpg`;

        await downloader.next({ path: join(__dirname, '..', '..', 'photos', filename), url });

        await this.storage.photoSize.update({
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
      console.log(++count);
    }

    console.log(errors);
    console.log(`Complete!!! Errors ${errors.length}`);
  }


  private async getPhotoAttachments(dialogId: number): Promise<AttachmenInfo[]> {
    const attachmentUrls = [];

    for await (let photos of this.photoAttachmentsLoader(dialogId)) {
      attachmentUrls.push(...photos);
      console.log(`Found: ${attachmentUrls.length}`);
    }

    return attachmentUrls;
  }

  private async *photoAttachmentsLoader(dialogId: number): AsyncIterable<AttachmenInfo[]> {

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
          ...pick(i.attachment.photo, 'id', 'owner_id'),
          url: getPhotoBestResolutionLink(i.attachment.photo),
          type: 'photo'
        };
      }).filter(i => i && i.url);

      params.start_from = result.response.next_from;

      yield photos;

      if (photos.length < 200) break;

    }
  }


}