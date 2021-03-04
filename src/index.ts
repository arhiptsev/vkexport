import { Attachments } from './attachments/attachments';
import { Messages } from './messages';
import readline from 'readline-sync';
import { Auth } from './auth';
import { ConversationsList, } from './types';
import syncRequest from 'sync-request';
import { Core } from './core';
import axios from 'axios';
import { Injectable } from './di/injectable';
import { AXIOS_TOKEN } from './constants';
import { Injector } from './di/injector';
import { HttpClient } from './http/http_client';
import { RequestBuilder } from './http/request_buider';
import { AttachmentDownloader } from './attachments/attachmentDownloader';
import { PhotoAttachments } from './attachments/photos';
import { VideoAttachemnts } from './attachments/videos';
import { PrismaClient } from '@prisma/client'
import { pick } from 'lodash';

@Injectable()
export class Main {

    private conversationId: number;

    constructor(
        private core: Core,
        private auth: Auth,
        private attachments: Attachments,
        private photoAttachments: PhotoAttachments,
        private videoAttachments: VideoAttachemnts,
        private messages: Messages,
        private http: HttpClient,
        private storage: PrismaClient
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
            await this.auth.writeToken(null);
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
        this.messages.downloadMessages(this.conversationId, this.conversationId.toString())
    }

    private async exportPhoto(): Promise<void> {
        await this.photoAttachments.downloadPhotosFromDialog(this.conversationId);
        console.log('Экспорт фото завершен');
        this.switchAction();
    }

    private async exportVideo(): Promise<void> {
        await this.videoAttachments.downloadVideoFormDialog(this.conversationId);
        console.log('Экспорт видео завершен');
        this.switchAction();
    }

    private exportAttachments(): void {
        try {
            this.attachments.downloadAttachmentsFromDialog(this.conversationId);
        } catch (error) {
            console.log(error.message);
            this.switchAction();
        }
    }

    private async requestPeerId(): Promise<void> {

        const peerId = readline.questionInt('Введите id диалога (0 не выбирать диалог):');

        if (peerId === 0) { return; }

        const peer = await this.storage.peer.findUnique(
            {
                where: { id: peerId },
                include: { conversation: true }
            }
        );

        if (peer) {
            this.conversationId = peer.conversation.export_id;
            return;
        }

        const res = await this.http.buildRequest()
            .section('messages')
            .method('getConversationsById')
            .params({
                peer_ids: peerId
            })
            .send<ConversationsList>();

        if (!res.response) {
            this.requestPeerId();
            return;
        }

        const [_dialog] = res.response.items;

        const dialog: any = pick(
            _dialog,
            'export_id',
            'last_message_id',
            'in_read',
            'out_read',
            'is_marked_unread',
            'important',
            'can_send_money',
            'can_receive_money',
            'peer'
        );

        try {
            const { response: [userInfo] } = await this.http.buildRequest()
                .section('users')
                .method('get')
                .params({
                    user_ids: `${dialog.peer.id}`,
                    fields: "photo_max"
                })
                .send<any>();

            dialog.peer.user_info = { create: userInfo };

        } catch (e) {
            throw new Error('Ошбика загрузки данных пользователя!');
        }

        dialog.peer = { create: dialog.peer };

        const { export_id } = await this.storage.conversation.create({
            data: dialog
        });
        this.conversationId = export_id;
    }
}

const injector = new Injector();

injector.provideDependencies([
    HttpClient,
    Core,
    PrismaClient,
    Auth,
    Messages,
    Attachments,
    VideoAttachemnts,
    PhotoAttachments,
    AttachmentDownloader,
    Main,
    {
        token: RequestBuilder,
        singleton: true
    },
    {
        token: AXIOS_TOKEN,
        value: axios.create()
    },
    {
        token: AXIOS_TOKEN,
        value: axios.create()
    }
])


injector.getDependency(Main);
