import { Auth } from "./auth";
import { responseMessages } from "./types";
import {writeFileSync } from 'fs';
import path from 'path';

export class Messages extends Auth {
    public async downloadMessages(user_id: number, dir: string): Promise<void> {
        let offset = 0;
        const count = 200;
        let messages = [];
        const params = {
            user_id: user_id,
            offset: offset,
            count: 200,
        }

        while (true) {

            const requestUrl = this.buildRequestUrl('messages', 'getHistory', params)
            const response = await this.sendRequestWithTimeout<responseMessages>(requestUrl, 300);
            const result = response.response;

            if (result.items.length < 200) break;
            params.offset += 200;
            messages.push(...result.items);
            console.log(`Downloads ${messages.length} from ${result.count}`);
        }

        const directory = path.join('users', dir);

        this.createDirectory(directory);

        writeFileSync(path.join(directory, 'messages.json'), JSON.stringify(messages));

    }



}