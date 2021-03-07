import { pick } from 'lodash';
import axios from 'axios';
import readline from 'readline-sync';
import { Peer, Conversation, PrismaClient } from '@prisma/client'

import { Injector } from './di/injector';
import { Attachments } from './attachments/attachments';
import { Messages } from './messages';
import { Auth } from './auth';
import { ConversationsList, ProfileInfo, } from './types';
import { Core } from './core';
import { Injectable } from './di/injectable';
import { AXIOS_TOKEN } from './constants';
import { HttpClient } from './http/http_client';
import { RequestBuilder } from './http/request_buider';
import { AttachmentDownloader } from './attachments/attachmentDownloader';
import { PhotoAttachments } from './attachments/photos';
import { VideoAttachemnts } from './attachments/videos';
import { FileDownloader } from './attachments/FileDownloader';

@Injectable()
export class Main {

  private conversationId: number;

  constructor(
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

  private async init(): Promise<void> {
    await this.auth.getToken();

    const name = await this.getNameOfCurrentToken();
    const accountIsSelected = readline.keyInYNStrict(`Текущий аккаунт: ${name}, продолжить работу или войти в другой аккаунт?`);

    if (!accountIsSelected) {
      await this.auth.writeToken(null);
      this.init();
      return;
    }

    await this.requestPeerId();
  }

  private async getNameOfCurrentToken(): Promise<string> {
    const { response } = await this.http.buildRequest()
      .section('account')
      .method('getProfileInfo')
      .send<ProfileInfo>();

    const { first_name, last_name } = response;

    return `${first_name} ${last_name}`;
  }

  private switchAction(): void {
    const action = readline.keyInSelect([
      'Экспортировать все сообщения в json.',
      'Экспортировать все фото из вложений.',
      'Экспортировать все фото из базы.',
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
      case 1: this.downloadPhotosFromDialog();
        break;
      case 2: this.downloadPhotosFromDB();
        break;
      case 3: this.exportVideo();
        break;
      case 4: this.exportAttachments();
        break;
    }

  }

  private async exportMessages(): Promise<void> {
    await this.messages.downloadMessages(this.conversationId, this.conversationId.toString())
    console.log('Экспорт сообщений завершен');
    this.switchAction();
  }

  private async downloadPhotosFromDialog(): Promise<void> {
    // await this.photoAttachments.downloadPhotosFromDialog();
    console.log('Экспорт фото завершен');
    this.switchAction();
  }

  private async downloadPhotosFromDB(): Promise<void> {
    await this.photoAttachments.downloadAllPhotos();
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

    if (peerId === 0) {
      this.switchAction();
      return;
    }

    const peer = await this.getPeer(peerId);

    if (peer) {
      this.conversationId = peer.conversation.export_id;
      this.switchAction();
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

    this.switchAction();
  }



  private getPeer(id: number): Promise<Peer & { conversation: Conversation }> {
    return this.storage.peer.findUnique(
      {
        where: { id },
        include: { conversation: true }
      }
    );
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
  FileDownloader,
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
