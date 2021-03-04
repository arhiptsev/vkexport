import {
  AttachmentsResponse,
  Photo,
  AttachmenInfo
} from '../types';
import { HttpClient } from '../http/http_client';
import { Injectable } from '../di/injectable';
import { pick } from 'lodash';
import { getMaxSize, getPhotoBestResolutionLink } from '../utils/attachments';
import { AttachmentDownloader } from './attachmentDownloader';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { Core } from '../core';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PhotoAttachments {

  constructor(
    private attachmentDownloader: AttachmentDownloader,
    private http: HttpClient,
    private core: Core,
    private storage: PrismaClient
  ) { }

  public async downloadPhotosFromDialog(dialogId: number): Promise<void> {


    let photos = await this.storage.photo.findMany({
      include: { sizes: true }
    });

    const filteredPhotos = photos.filter(photo => photo.sizes.every(s => !s.file));

    photos = null;

    let count = 0;
    const errors = [];

    for (const photo of filteredPhotos) {
      const url = getMaxSize(photo.sizes);
      const { export_id } = photo.sizes.find(size => size.url === url);

      try {
        const filename = `${uuidv4()}.jpg`;
        await this.core.downloadFile(`${join(__dirname, '..', '..', 'photos', filename)}`, url);

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

    // photos.forEach()
    // console.log(photos.avg.export_photo_id);
    // photos
    // photos.forEach(photo => photo['test'] = getMaxSize(photo));

    // const dir = join('users', `${dialogId}`, 'photo');
    // const urls = await this.getPhotoAttachments(dialogId);
    // await this.attachmentDownloader.download(urls, dir);
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