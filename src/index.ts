import { Attachments } from './attachments/attachments';
import { Messages } from './messages';
import readline from 'readline-sync';
import { Auth } from './auth';
import { Attachment, ConversationsList, Message, Photo, Video, VideoFiles } from './types';
import syncRequest from 'sync-request';
import { Core } from './core';
import axios from 'axios';
import { Injectable } from './di/injectable';
import { AXIOS_TOKEN } from './constants';
import { Injector } from './di/injector';
import { HttpClient } from './http/http_client';
import { RequestBuilder } from './http/request_buider';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getJsonFromFile, isPhoto, isVideo } from './utils/get-json-from-file';


@Injectable()
export class Main {

    private peerId: number;

    constructor(
        private core: Core,
        private auth: Auth,
        private attachments: Attachments,
        private messages: Messages,
        private http: HttpClient
    ) {
        this.init();
    }

    private getNameOfCurrentToken(): string {
        const request = this.core.buildRequestUrl('account', 'getProfileInfo');
        const res = syncRequest('GET', request);

        const data = JSON.parse(res.body.toString());
        return `${data.response.first_name} ${data.response.last_name}`;
    }


    private async init(): Promise<void> {

        await this.auth.getToken();

        const name = this.getNameOfCurrentToken();

        if (!readline.keyInYNStrict(`Текущий аккаунт: ${name}, продолжить работу или войти в другой аккаунт?`)) {
            this.auth.writeToken(null);
            await this.auth.getToken();
            this.init();
        }
        await this.requestPeerId();
        this.switchAction();
    }

    private switchAction(): void {

        const action = readline.keyInSelect([
            'Экспортировать все сообщения в json.',
            'Экспортировать все фото из вложений.',
            'Экспортировать все видео из вложений.',
            'Экспортировать все вложения для диалога.',
        ],
            'Что вы хотите экспортировать?',
            {
                cancel: 'Выбрать другой диалог'
            }
        );

        switch (action) {
            case -1: this.init();
                break;
            case 0: this.exportMessages();
                break;
            case 1: this.exportPhoto();
                break;
            case 2: this.exportVideo();
                break;
            case 3: this.exportAttachments();
                break;
        }

    }

    private exportMessages(): void {
        this.messages.downloadMessages(this.peerId, this.peerId.toString())
    }

    private async exportPhoto(): Promise<void> {
        await this.attachments.downloadPhotosFromDialog(this.peerId, this.peerId.toString());
        console.log('Экспорт фото завершен');
        this.switchAction();
    }

    private async exportVideo(): Promise<void> {
        await this.attachments.downloadVideoFormDialog(this.peerId, this.peerId.toString());
        console.log('Экспорт видео завершен');
        this.switchAction();
    }

    private exportAttachments(): void {
        try {
            this.attachments.downloadAttachmentsFromDialog(this.peerId);
        } catch (error) {
            console.log(error.message);
            this.switchAction();
        }
    }

    private async requestPeerId(): Promise<void> {

        this.peerId = readline.questionInt('Введите id диалога:');

        const res = await this.http.buildRequest()
            .section('messages')
            .method('getConversationsById')
            .params({
                peer_ids: this.peerId
            })
            .send<ConversationsList>();

        if (!res.response) {
            this.requestPeerId();
        }
    }
}

const injector = new Injector();

injector.provideDependencies([
    Main,
    Core,
    Auth,
    Attachments,
    Messages,
    HttpClient,
    {
        token: RequestBuilder,
        singleton: true
    },
    {
        token: AXIOS_TOKEN,
        value: axios.create()
    }
])


injector.getDependency(Main);
