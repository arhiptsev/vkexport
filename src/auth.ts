import readline from 'readline-sync';
import { readFileSync, writeFileSync } from 'fs';
import { AXIOS_TOKEN } from './constants';
import { AxiosInstance } from 'axios';
import { AuthParams } from './types';
import { Injectable } from './di/injectable';
import { Inject } from './di/inject';

@Injectable()
export class Auth {

    private username: string;
    private password: string;
    public token: string;

    constructor(
        @Inject(AXIOS_TOKEN) private axios: AxiosInstance
    ) { }

    public async getToken(): Promise<void> {

        try {
            const tokenFile = readFileSync('./token.json');
            const token = JSON.parse(tokenFile.toString());
            if (!token.token) throw new Error();
            this.token = token.token;
        }
        catch {
            this.username = this.requestUsername();
            this.password = this.requestPassword();
            try {
                const res = await this.sendAuthRequest();
                this.writeToken(res.access_token);
                await this.getToken();
            }
            catch (error) {
                await this.errorHandler(error.response.data);
            }
        }
    }


    private requestUsername(): string {
        let username = readline.question('Авторизованный аккаунт не найден, введите ваш логин: ');
        if (!username) { username = this.requestUsername(); }
        return username;
    }

    private async sendAuthRequest(code?: string): Promise<any> {

        const params: AuthParams = {
            grant_type: 'password',
            client_id: 2274003,
            client_secret: 'hHbZxrka2uZ6jB1inYsH',
            username: this.username,
            password: this.password,
            v: 5.103,
            '2fa_supported': 1
        };

        if (code) {
            params.code = code;
        };

        const { data } = await this.axios.get('https://oauth.vk.com/token', { params });
        return data;
    }

    public writeToken(token: string): void {
        writeFileSync('./token.json', JSON.stringify({ token: token }));
    }

    private async errorHandler(res: any): Promise<void> {
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

    private async validation(): Promise<void> {
        const code = this.requestCode();
        const r = await this.sendAuthRequest(code);
        if (r.access_token) {
            this.writeToken(r.access_token);
            this.getToken();
        } else {
            this.validation()
        }
    }

    private requestCode(): string {
        let code = readline.question('Введите проверочный код: ');
        if (!code) { code = this.requestCode(); }
        return code;
    }

    private requestPassword(): string {
        let password = readline.question('Введите ваш пароль: ');
        if (!password) { password = this.requestPassword(); }
        return password;
    }

}
