import { AttachmenInfo } from '../types';
import cliProgress from 'cli-progress';
import { join } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { Core } from '../core';
import { Injectable } from '../di/injectable';
import { FORMAT_PROGRESS_BAR } from '../common/constants';

@Injectable()
export class AttachmentDownloader {

  constructor(
    private core: Core,
  ) { }

  public async download(attachments: AttachmenInfo[], dir: string): Promise<void> {

    this.core.createDirectory(dir);
    const bar = this.initProgressBar();
    let loaded = 0;
    console.log('Downloading attachemnts:');
    bar.start(100, 0, { loaded, totalItems: attachments.length });

    for (let attachment of attachments) {
      bar.update(0, { loaded });

      const name = `${attachment.type}_${attachment.owner_id}_${attachment.id}`;
      const ext = attachment.type === 'video' ? 'mp4' : 'jpg';
      const filename = `${name}.${ext}`;
      if (existsSync(join(dir, filename))) {
        loaded++;
        continue
      };

      try {
        await this.core.downloadFile(join(dir, `${filename}`), attachment.url, (c, l) => {
          bar.update(Math.floor(c / (l / 100)));
        });
      } catch {

       }
      loaded++;
    }

    
    // writeFileSync(join(dir, 'errors.json'), JSON.stringify(errors));
  }

  private initProgressBar(): cliProgress.SingleBar {
    return new cliProgress.SingleBar({
      format: FORMAT_PROGRESS_BAR,
    }, cliProgress.Presets.shades_classic);
  }

}