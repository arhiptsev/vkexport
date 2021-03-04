import readline from 'readline-sync';
import { AXIOS_TOKEN } from './constants';
import { AxiosInstance } from 'axios';
import { AuthParams } from './types';
import { Injectable } from './di/injectable';
import { Inject } from './di/inject';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class Auth {

    private username: string;
    private password: string;
    public token: string;

    constructor(
        @Inject(AXIOS_TOKEN) private axios: AxiosInstance,
        private storage: PrismaClient
    ) { }

    public async getToken(): Promise<void> {

        try {
            const { value: token } = await this.storage.options.findUnique({ where: { key: 'vk_token' } });
            if (!token) throw new Error();
            this.token = token;
        }
        catch {
            this.username = this.requestUsername();
            this.password = this.requestPassword();
            try {
                const res = await this.sendAuthRequest();
                await this.writeToken(res.access_token);
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

    public writeToken(token: string): Promise<any> {
        return this.storage.options.update({
            where: {
                key: 'vk_token'
            },
            data: {
                value: token
            }
        });
    }

    private async errorHandler(res: any): Promise<void> {
        switch (res.error) {
            case 'need_validation':
                await this.validation();
                break;
            case 'invalid_client':
                await this.invalidClientHandler(res);
                break;
            default: throw new Error('Возникла непредвиденная ошибка!');
        }

    }

    private async invalidClientHandler(res: any): Promise<void> {
        if (res.error_type === 'username_or_password_is_incorrect') {
            console.log('Неверный логин или пароль.')
            await this.getToken();
        } else {
            throw new Error('Возникла непредвиденная ошибка!');
        }
    }

    private async validation(): Promise<void> {
        const code = this.requestCode();
        const r = await this.sendAuthRequest(code);
        if (r.access_token) {
            await this.writeToken(r.access_token);
            await this.getToken();
        } else {
            await this.validation()
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
