import fetch, { Response } from 'node-fetch';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { ApiResponse } from './types';
import { AxiosInstance } from 'axios';
import { Inject } from './di/inject';
import { AXIOS_TOKEN } from './constants';
import { Auth } from './auth';
import { Injectable } from './di/injectable';


@Injectable()
export class Core {

    constructor(
        private auth: Auth,
        @Inject(AXIOS_TOKEN) protected http: AxiosInstance,
    ) { }

    public sendRequestWithTimeout<T>(request: string, timeout: number): Promise<ApiResponse<T>> {
        return new Promise<ApiResponse<T>>(resolve =>
            setTimeout(() =>
                this.http.get<ApiResponse<T>>(request)
                    .then(res => res.data)
                    .then(resolve),
                timeout
            ));
    }

    public buildRequestUrl(section: string, method: string, params?: { [key: string]: string | number }): string {

        const url = 'https://api.vk.com/method';
        let requestUrl = `${url}/${section}.${method}?access_token=${this.auth.token}&v=5.101`;
        if (params) {
            for (let key in params) {
                requestUrl += `&${key}=${params[key]}`;
            }
        }
        return requestUrl;
    }

    public downloadFile(
        fullPath: string,
        url: string,
        onProgress?: (current: number, length: number) => void
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(res => {
                    if (!res.ok) reject(`Ошибка загрузки: ${url}`);

                    let currentLength = 0;
                    const fullLength = +res.headers.get('Content-Length');
                    res.body.on('data', d => {
                        currentLength += d.length;
                        !onProgress || onProgress(currentLength, fullLength);
                    });
                    const stream = createWriteStream(fullPath);
                    stream.on('finish', resolve);
                    res.body.on('error', reject)
                    res.body.pipe(stream);

                });
        });
    }

    public createDirectory(dir: string): void {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }
}