import {
  AttachmentsResponse,
  Photo,
  AttachmenInfo
} from '../types';
import { HttpClient } from '../http/http_client';
import { Injectable } from '../di/injectable';
import { pick } from 'lodash';
import { getPhotoBestResolutionLink } from '../utils/attachments';
import { AttachmentDownloader } from './attachmentDownloader';
import { join } from 'path';

@Injectable()
export class PhotoAttachments {

  constructor(
    private attachmentDownloader: AttachmentDownloader,
    private http: HttpClient
  ) { }

  public async downloadPhotosFromDialog(dialogId: number): Promise<void> {
    const dir = join('users', `${dialogId}`, 'photo');
    const urls = await this.getPhotoAttachments(dialogId);
    await this.attachmentDownloader.download(urls, dir);
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