import { Auth } from "./auth";
import { responseMessages, ApiResponse } from "./types";
import { Response } from "node-fetch";

export class Messages extends Auth {
    public async downloadMessages(user_id: number, dir: string) {
        let offset = 0;
        const count = 200;
        let messages = [];

        while (true) {
            const result = await new Promise<responseMessages>(resolve => {
                setTimeout(
                    () => {
                        this.fetch(`https://api.vk.com/method/messages.getHistory?user_id=${user_id}&offset=${offset}&access_token=${this.token}&v=5.101&count=${count}`)
                            .then((res: Response) => res.json())
                            .then((res: ApiResponse<responseMessages>) => resolve(res.response));
                    },
                    300
                );

            });
            if (result.items.length < 200) break;
            offset = offset + 200;
            messages.push(...result.items);
            console.log(`Downloads ${messages.length} from ${result.count}`);
        }
        this.fs.writeFileSync(this.path.join(__dirname, 'users', dir, 'messages.json'), JSON.stringify(messages));

    }


}