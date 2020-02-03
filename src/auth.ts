import { Core } from './core';
import readline from 'readline-sync';
import syncRequest from 'sync-request';
import fs from 'fs';

export class Auth extends Core {

    private username: string;
    private password: string;

    constructor() {
        super();
        this.getToken();
    }

    protected getToken(): void {

        try {
            const tokenFile = fs.readFileSync('./token.json');
            const token = JSON.parse(tokenFile.toString());
            if (!token.token) throw new Error();
            this.token = token.token;
        }
        catch (e) {
            this.username = this.requestUsername();
            this.password = this.requestPassword();
            const res = this.sendAuthRequest();
            if (res.hasOwnProperty('error') && !res.hasOwnProperty('access_token')) {
                this.errorHandler(res);
            } else {
                this.writeToken(res.access_token);
                this.getToken();
            }
        }
    }

    private requestUsername(): string {
        let username = readline.question('Token not found, enter you Username: ');
        if (!username) { username = this.requestUsername(); }
        return username;
    }

    private sendAuthRequest(code?: string): any {
        let url = `https://oauth.vk.com/token?grant_type=password&client_id=2274003&client_secret=hHbZxrka2uZ6jB1inYsH&username=${this.username}&password=${this.password}&v=5.103&2fa_supported=1`;
        if (code) url += `&code=${code}`;
        let res: any = syncRequest('GET', url)
        res = JSON.parse(res.body.toString());
        return res;
    }

    private writeToken(token: string): void {
        this.fs.writeFileSync('./token.json', JSON.stringify({ token: token }));
    }

    private errorHandler(res: any): void {
        switch (res.error) {
            case 'need_validation':
                this.validation();
                break;
            case 'invalid_client':
                this.invalidClientHandler(res);
                break;
            default: throw new Error('Возникла непредвиденная ошибка!');
        }

    }

    private invalidClientHandler(res: any): void {
        if (res.error_type === 'username_or_password_is_incorrect') {
            console.log('Неверный логин или пароль.')
            this.getToken();
        } else {
            throw new Error('Возникла непредвиденная ошибка!');
        }
    }

    private validation(): void {
        const code = this.requestCode();
        const r = this.sendAuthRequest(code);
        if (r.access_token) {
            this.writeToken(r.access_token);
            this.getToken();
        } else {
            this.validation()
        }
    }

    private requestCode(): string {
        let code = readline.question('Need validation, enter code: ');
        if (!code) { code = this.requestCode(); }
        return code;
    }

    private requestPassword(): string {
        let password = readline.question('Enter your password: ');
        if (!password) { password = this.requestPassword(); }
        return password;
    }

}
