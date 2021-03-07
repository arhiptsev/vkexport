import cliProgress from 'cli-progress';

import { AttachmenInfo } from '../types';
import { Core } from '../core';
import { Injectable } from '../di/injectable';
import { FORMAT_PROGRESS_BAR } from '../common/constants';


@Injectable()
export class FileDownloader {

  constructor(
    private core: Core,
  ) { }

  public async *createDownloader(total: number): AsyncIterator<AttachmenInfo, void, {
    url: string,
    path: string
  } | undefined | null> {
    const bar = this.initProgressBar();
    let loaded = 0;

    bar.start(100, 0, { loaded, totalItems: total });

    while (true) {

      const payload = yield;
      if (payload === null) continue;
      if (payload === undefined) break;
      const { url, path } = payload;

      bar.update(0, { loaded });

      try {
        await this.core.downloadFile(path, url, (c, l) => {
          bar.update(Math.floor(c / (l / 100)));
        });
      } catch {

      }
      loaded++;
    }
  }

  private initProgressBar(): cliProgress.SingleBar {
    return new cliProgress.SingleBar({
      format: FORMAT_PROGRESS_BAR,
    }, cliProgress.Presets.shades_classic);
  }

}

