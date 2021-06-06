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
import { ATTACHMENT_EXTENSIONS } from './constants';

@Injectable()
export class AudioMessage {

  constructor(
    private storage: PrismaClient,
    private fileDownloader: FileDownloader
  ) { }

  public async downloadAllAudioMessages(): Promise<void> {

    const audioMessages = await this.storage.audioMessage.findMany();
    const filteredAudio = audioMessages.filter(audio => audio.link_mp3);

    let count = 0;
    const errors = [];

    const downloader = this.fileDownloader.createDownloader(audioMessages.length);

    for (const audio of filteredAudio) {
      const url = audio.link_mp3;
      const { export_id } = audio;

      try {
        const filename = `${uuidv4()}.${ATTACHMENT_EXTENSIONS.audio}`;

        await downloader.next({ path: join(__dirname, '..', '..', 'audios', filename), url });

        await this.storage.audioMessage.update({
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

}