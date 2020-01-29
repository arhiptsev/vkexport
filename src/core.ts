import fetch from 'node-fetch';
import * as fs from 'fs';
import path from 'path';


export class Core {
    fetch = fetch;
    fs = fs;
    path = path;
}