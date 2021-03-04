import { Attachment, Message, Photo, responseMessages, PhotoInput } from "./types";
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Core } from "./core";
import { Injectable } from "./di/injectable";
import { PrismaClient, Video } from "@prisma/client";
import { add, every, isArray, isBoolean, isNumber, isObject, isObjectLike, isString, map, omit, uniqueId, values } from "lodash";
import { keys } from "ts-transformer-keys";
import { O_NONBLOCK } from "constants";

const ATTACHMENTS_TYES = ['video', 'photo', 'audio_message', 'audio'];

const EXCLUDE_FIEILDS = [
  'action_button',
  'restriction',
  'album',
  'featured_artists',
  'lyrics_id',
  'subtitle',
  'geo'
];
@Injectable()
export class Messages {

  constructor(
    private core: Core,
    private storage: PrismaClient
  ) {

  }

  public async downloadMessages(conversation_id: number, dir: string): Promise<void> {

    const conversation = await this.storage.conversation.findUnique({
      where: {
        export_id: conversation_id
      }, include: {
        peer: true
      }
    });


    let offset = 0;
    let messages: Message[] = [];
    const params = {
      peer_id: conversation.peer.id,
      offset: offset,
      count: 200,
    }

    while (true) {

      const requestUrl = this.core.buildRequestUrl('messages', 'getHistory', params)
      const response = await this.core.sendRequestWithTimeout<responseMessages>(requestUrl, 300);
      const result = response.response;

      params.offset += 200;


      await this.storage.conversation.update({
        where: {
          export_id: conversation.export_id
        },
        data: {
          message: {
            create: this.formatDataForCreate(result.items)
          }
        }
      });


      messages.push(...result.items);
      console.log(`Downloads ${messages.length} from ${result.count}`);
      if (result.items.length < 200) break;
    }

    const directory = join('users', dir);

    this.core.createDirectory(directory);

    writeFileSync(join(directory, 'messages.json'), JSON.stringify(messages));

  }

  private formatDataForCreate<T extends Object>(obj: T) {
    const cloneObj = JSON.parse(JSON.stringify(obj));
    this.addCreateKeyForRelations(cloneObj);
    return cloneObj;
  }

  private addCreateKeyForRelations(_obj: any, exclude: string[] = []): void {
    let obj = _obj;

    if (isArray(obj)) {
      obj.forEach((value) => {
        this.addCreateKeyForRelations(value);
      });
      return;
    }

    EXCLUDE_FIEILDS.forEach(field => { delete obj[field]});

    if (obj.attachments && isArray(obj.attachments)) {
      obj.attachments = obj.attachments.filter(({ type }) => ATTACHMENTS_TYES.includes(type));
    }

    (!isArray(obj) && isObjectLike(obj)) && Object.entries(obj)
      .forEach(([key, value]) => {
        if (!isArray(value) && !isObjectLike(value)) { return; }
        if (isArray(value) && value.every(i => isString(i) || isBoolean(i) || isNumber(i))) { return; }
        obj[key] = { create: value }
        this.addCreateKeyForRelations(value);
      });

  }

}