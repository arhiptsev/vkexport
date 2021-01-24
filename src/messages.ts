import { responseMessages } from "./types";
import { writeFileSync } from 'fs';
import  { join } from 'path';
import { Core } from "./core";
import { Injectable } from "./di/injectable";

@Injectable()
export class Messages {

    constructor(
        private core: Core
    ){

    }

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

            const requestUrl = this.core.buildRequestUrl('messages', 'getHistory', params)
            const response = await this.core.sendRequestWithTimeout<responseMessages>(requestUrl, 300);
            const result = response.response;

            if (result.items.length < 200) break;
            params.offset += 200;
            messages.push(...result.items);
            console.log(`Downloads ${messages.length} from ${result.count}`);
        }

        const directory = join('users', dir);

        this.core.createDirectory(directory);

        writeFileSync(join(directory, 'messages.json'), JSON.stringify(messages));

    }



}