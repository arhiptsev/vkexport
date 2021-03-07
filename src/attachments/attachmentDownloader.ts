import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { AttachmenInfo } from '../types';
import { Core } from '../core';
import { Injectable } from '../di/injectable';
import { FileDownloader } from './FileDownloader';


@Injectable()
export class AttachmentDownloader {

  constructor(
    private core: Core,
    private fileDownloader: FileDownloader
  ) { }

  public async download(attachments: AttachmenInfo[], dir: string): Promise<void> {

    this.core.createDirectory(dir);
    const downloader = this.fileDownloader.createDownloader(attachments.length);
    console.log('Downloading attachemnts:');

    for (let attachment of attachments) {

      const name = `${attachment.type}_${attachment.owner_id}_${attachment.id}_${uuidv4()}`;
      const ext = attachment.type === 'video' ? 'mp4' : 'jpg';
      const filename = `${name}.${ext}`;
      const path = join(dir, filename);

      await downloader.next({ url: attachment.url, path });


      if (existsSync(join(dir, filename))) {
        continue;
      };

    }
    // writeFileSync(join(dir, 'errors.json'), JSON.stringify(errors));
  }

}

