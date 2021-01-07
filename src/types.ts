
export interface ApiResponse<T> {
    response: T;
}

export type AuthParams = {
    grant_type: string;
    client_id: number;
    client_secret: string;
    username: string;
    password: string;
    v: number;
    '2fa_supported': 1 | 0;
    code?: string;
}

export interface VideosIdentificationData {
    id: number;
    owner_id: number;
    access_key: string;
}

export interface PhotoData {
    messageId: number;
    id: number,
    url: string;
};

export interface AttachmentsResponse<T> {
    items: Array<MessageAttachement<T>>;
    next_from: string;
    profiles: Array<any>;
}

export interface MessageAttachement<T> {
    message_id: number;
    from_id: number;
    attachment: Attachment<T>
}

export interface responseMessages {
    items: Array<Message>;
    count: number;
}

export interface responseVideo {
    count: number;
    items: Video[];
}

export interface ConversationsList {
    count: number;
    items: Conversation[];
}

export interface Conversation {

    peer: {
        id: number;
        type: string;
        local_id: number;
    };
    last_message_id: number,
    in_read: number,
    out_read: number,
    can_write: {
        allowed: boolean
    }

}

export interface Message {
    id: number;
    text: string;
    user_id: number;
    from_id: number;
    peer_id: number;
    date: number;
    read_state: boolean;
    out: boolean;
    fwd_messages: Array<Message>;
    reply_message: Message;
    important: boolean;
    random_id: number;
    attachments: Array<Attachment<Photo | Video | Audio | Doc | Link | Market | Wall>>;
    id_hidden: boolean;
    conversation_message_id: number;
}

export interface Attachment<T extends Photo | Video | Audio | Doc | Link | Market | Wall> {
    type: attachmentType;
    photo?: T;
    video?: T;
    audio?: T;
    doc?: T;
    link?: T;
    market?: T;
    wall?: T;
}

export type attachmentType = "photo" | "video" | "audio" | "doc" | "link" | "market" | "wall";


export interface Photo {
    id: number;
    album_id: number;
    owner_id: number;
    user_id: number;
    text: string;
    date: number;
    sizes: Array<PhotoSizes>;
    width: number;
    height: number;
    access_key: string;
}

export interface PhotosDataForDownlod {
    messageId: number;
    id: number;
    url: string;
}

export interface PhotoSizes {
    type: string;
    url: string;
    width: number;
    height: number;
}

export interface Video {
    id: number;
    album_id: number;
    title: string;
    description: string;
    duration: number;
    files: VideoFiles;
    owner_id: number;
    // photo_130: string;
    // photo_320: string;
    // photo_640: string;
    // photo_800: string;
    // photo_1280: string;
    // first_frame_130: string;
    // first_frame_320: string;
    // first_frame_640: string;
    // first_frame_800: string;
    // first_frame_1280: string;
    first_frame: Array<VideoImage>;
    date: number;
    adding_date: number;
    views: number;
    comments: number;
    player: string;
    platform: string;
    can_edit: boolean;
    can_add: boolean;
    is_private: boolean;
    access_key: string;
    processing: boolean;
    live: boolean;
    upcoming: boolean;
    is_favorite: boolean;
    image: Array<VideoImage>;
    type: string;

}

export interface VideoFiles {
    mp4_240?: string;
    mp4_360?: string;
    mp4_480?: string;
    mp4_720?: string;
    hls?: string;
    external?: string;
}


export interface VideoImage {
    height: number;
    width: number;
    url: string;
    with_padding?: boolean;
}

export interface Audio {

}

export interface Doc {

}

export interface Link {

}

export interface Market {

}

export interface Wall {

}