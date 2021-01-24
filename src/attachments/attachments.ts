import {
  Attachment,
  Message,
  AttachmenInfo
} from '../types';
import { join } from 'path';
import { existsSync } from 'fs';
import { Injectable } from '../di/injectable';
import { getJsonFromFile, isPhoto, isVideo } from '../utils/get-json-from-file';
import { pick } from 'lodash';
import { getPhotoBestResolutionLink, getVideoBestResolutionLink } from '../utils/attachments';
import { AttachmentDownloader } from './attachmentDownloader';

@Injectable()
export class Attachments {

  constructor(
    private attachmentDownloader: AttachmentDownloader,
  ) { }


  public async downloadAttachmentsFromDialog(peerId:number): Promise<void> {
    const directory = join('users', `${peerId}`);


    if (!existsSync(join(directory, 'messages.json'))) {
      throw new Error('Для этого пользователя диалог не загружен!');
    }

    try {
      const messages = getJsonFromFile(join(directory, 'messages.json'));
      const result = this.getAttachmentUrlsFromMessages(messages);

      const dir = join('users', `${peerId}`, 'attachments');
      await this.attachmentDownloader.download(result, dir);
      // writeFileSync(join('users', `${peerId}`, 'test.json'), JSON.stringify(result));
    } catch {
      throw new Error('Ошибка чтения диалога!');
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

}