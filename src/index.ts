import { Attachments } from './attachments';
import { Messages } from './messages';
import readline from 'readline-sync';
import { Auth } from './auth';
import { ConversationsList } from './types';
import syncRequest from 'sync-request';

export class Main extends Auth {
    private peerId: number;

    constructor() {
        super();
        this.init();
    }

    private getNameOfCurrentToken(): string {
        const request = this.buildRequestUrl('account', 'getProfileInfo');
        const res = syncRequest('GET', request);
        const data = JSON.parse(res.body.toString());
        return `${data.response.first_name} ${data.response.last_name}`;
    }




    private init(): void {

        const name = this.getNameOfCurrentToken();

        if (!readline.keyInYNStrict(`Текущий аккаунт: ${name}, продолжить работу или войти в другой аккаунт?`)) {
            this.writeToken(null);
            this.getToken();
            this.init();
        }
        this.requestPeerId();
        this.switchAction();
    }

    private switchAction(): void {
        const action = readline.keyInSelect([
            'Экспортировать все сообщения в json.',
            'Экспортировать все фото из вложений.',
            'Экспортировать все видео из вложений.',
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
        }


    }

    private exportMessages(): void {
        const messages = new Messages();
        messages.downloadMessages(this.peerId, this.peerId.toString())
    }

    private exportPhoto(): void {
        const attachments = new Attachments();
        attachments.downloadPhotosFromDialog(this.peerId, this.peerId.toString());
    }

    private exportVideo(): void {
        const attachments = new Attachments();
        attachments.downloadVideoFormDialog(this.peerId, this.peerId.toString());
    }

    private requestPeerId(): void {
        this.peerId = readline.questionInt('Введите id диалога:');
        this.sendRequestWithTimeout<ConversationsList>(
            this.buildRequestUrl('messages', 'getConversationsById', { peer_ids: this.peerId })
            , 0
        ).then(res => {
            if (!res.response) {
                console.log('Неверный идентификатор диалога!!!');
                this.requestPeerId();
            }
        });
    }
}


new Main();

// const a = new Messages();
// a.downloadMessages(52968280,'zima');

















































