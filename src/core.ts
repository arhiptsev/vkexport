import fetch, { Response } from 'node-fetch';
import fs, { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { ApiResponse } from './types';



export class Core {
    fetch = fetch;
    fs = fs;
    path = path;
    protected token: string = null;

    protected sendRequestWithTimeout<T>(request: string, timeout: number): Promise<ApiResponse<T>> {
        return new Promise<ApiResponse<T>>(resolve =>
            setTimeout(() =>
                this.fetch(request)
                    .then((res: Response) => res.json())
                    .then(resolve),
                timeout
            ));
    }

    protected buildRequestUrl(section: string, method: string, params?: { [key: string]: string | number }): string {

        const url = 'https://api.vk.com/method';
        let requestUrl = `${url}/${section}.${method}?access_token=${this.token}&v=5.101`;
        if (params) {
            for (let key in params) {
                requestUrl += `&${key}=${params[key]}`;
            }
        }
        return requestUrl;
    }

    protected async downloadFile(
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
                        const stream = fs.createWriteStream(fullPath);
                        stream.on('finish', resolve);
                        res.body.on('error', reject)
                        res.body.pipe(stream);
                    }
                });

        });
    }

    protected createDirectory(dir: string): void {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }
}