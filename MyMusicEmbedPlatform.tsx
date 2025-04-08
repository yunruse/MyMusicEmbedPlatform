/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, ReporterTestable } from "@utils/types";


enum Platform {
    SPOTIFY = "spotify",
    APPLE = "appleMusic",
    AMAZON = "amazonMusic",
}

const PLATFORM_INFO = {
    [Platform.SPOTIFY]: {
        linkPrefix: "https://open.spotify.com/",
        embedPrefix: "https://open.spotify.com/embed/",
        albumStyle: "max-width: 400px; min-width: 300px; width: 100%; height: 352px;",
        songStyle: "max-width: 400px; min-width: 300px; width: 100%; height: 80px;",
    },
    [Platform.APPLE]: {
        linkPrefix: "https://geo.music.apple.com/",
        embedPrefix: "https://embed.music.apple.com/",
        albumStyle: "max-width: 660px; min-width: 300px; width: 100%; height: 450px;",
        songStyle: "max-width: 660px; min-width: 300px; width: 100%; height: 175px;",
    },
    [Platform.AMAZON]: {
        linkPrefix: "https://music.amazon.com/",
        embedPrefix: "https://music.amazon.com/embed/",
        albumStyle: "width: 500px; height: 352px;",
        songStyle: "width: 500px; height: 240px;",
    },

    // return 
}
function getPlatform(url: string): Platform | null {
    for (const platform of Object.values(Platform)) {
        if (url.startsWith(PLATFORM_INFO[platform].linkPrefix))
            return platform;
        if (url.startsWith(PLATFORM_INFO[platform].embedPrefix))
            return platform;
    }
    return null
}

function embedURL(url: string, platform: Platform) {
    if (!url) return url;
    url = url.replace(PLATFORM_INFO[platform].linkPrefix, PLATFORM_INFO[platform].embedPrefix);

    switch (platform) {
        case Platform.APPLE:
            return url + '?theme=dark';
        case Platform.SPOTIFY:
            return url + "?utm_source=discord&utm_medium=desktop";
        case Platform.AMAZON:
            url = url.replace('/embed/albums/', '/embed/')
            url = url.replace('/embed/songs/', '/embed/')
            return url;
    }
}

async function getMusicURL(url: string, platform: Platform): Promise<{ url: string | undefined, kind: string | undefined }> {
    const CORS_PROXY = "https://api.allorigins.win/get?url=";
    const API = "https://api.song.link/v1-alpha.1/links/";
    const params = new URLSearchParams({ url });
    return await fetch(`${CORS_PROXY}${API}?${params}`)
        .then(r => r.json())
        .then(json => JSON.parse(json['contents']))
        .then(data => {
            let entities: Array<any> = data['entitiesByUniqueId'];
            let kind = Object.values(entities)[0].type;
            let url = embedURL(data.linksByPlatform[platform]?.url, platform);
            return { url, kind };
        }).catch(e => {
            console.warn('Error when parsing!', e);
            return { url: undefined, kind: undefined }
        })
}

const settings = definePluginSettings({
    streamProvider: {
        type: OptionType.SELECT,
        description: "What stream provider to convert to?",
        options: [
            { label: "Spotify", value: Platform.SPOTIFY, default: true },
            { label: "Apple Music", value: Platform.APPLE },
            { label: "Amazon Music", value: Platform.AMAZON },
        ]
    },
});

export default definePlugin({
    name: "MyMusicEmbedPlatform",
    description: "Change music album or song embeds to use your streaming platform.",
    authors: [Devs.yunruse],
    settings,

    async start() {
        await this.checkFrames();
        this.checkInterval = setInterval(
            () => this.checkFrames().catch(console.error),
            500);
    },
    stop() {
        clearInterval(this.checkInterval);
    },
    async checkFrames() {
        document.body.querySelectorAll('iframe').forEach(async iframe => {
            let srcUrl = iframe.src.replace('https://www.', 'https://').replace(/\?.+/, "")

            let srcPlatform = getPlatform(srcUrl);
            let dstPlatform: Platform = settings.store.streamProvider;

            if (!srcPlatform) return; // not a music embed
            if (dstPlatform === srcPlatform) return; // already done
            if (dstPlatform === iframe.mymusiclink) return; // already the right platform

            iframe.mymusiclink = dstPlatform;
            let { url, kind } = await getMusicURL(srcUrl, dstPlatform);
            if (!url || !kind) return;
            iframe.src = url;

            if (kind === "album")
                iframe.style = PLATFORM_INFO[dstPlatform].albumStyle;
            else
                iframe.style = PLATFORM_INFO[dstPlatform].songStyle;
        })
    },
});
