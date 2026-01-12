import {
    Chapter,
    ChapterDetails,
    ContentRating,
    SourceManga,
    Tag,
    TagSection,
} from "@paperback/types";
import { Cheerio, CheerioAPI, load } from "cheerio";
import { Element } from "domhandler";
import { BentaiGeneric } from "./Bentai";
import { getUseHQThumbnails } from "./BentaiSettings";

export interface DirectoryTile {
    mangaId: string;
    title: string;
    subtitle?: string;
    imageUrl: string;
}

export class BentaiParser {
    async parseDirectory(
        $: CheerioAPI,
        source: BentaiGeneric,
    ): Promise<DirectoryTile[]> {
        const tiles: DirectoryTile[] = [];
        const scoped = $(source.gallerySelector).find("div.thumb").toArray();
        const candidates =
            scoped.length > 0 ? scoped : $("div.thumb").toArray();

        for (const obj of candidates) {
            const href =
                $('a[href*="/gallery/"]', obj).first().attr("href") ??
                $("a", obj).first().attr("href") ??
                "";
            const mangaId = this.idFromHref(href);
            if (!mangaId) continue;

            const titleCandidate =
                $("h2 a", obj).first().text().trim() ||
                $("h2", obj).first().text().trim() ||
                $(".gallery_title a", obj).first().text().trim() ||
                $("a[href*='/gallery/']", obj).first().attr("title") ||
                "";
            const title = titleCandidate.trim();
            if (!title) continue;

            const innerThumbImg = $("div.inner_thumb img", obj).first();
            const thumbImg = innerThumbImg.length
                ? innerThumbImg
                : $("img", obj).not(".thumb_flag").first();

            const imageUrl = await this.getImageSrc(thumbImg, source);

            const subtitle =
                $(source.subtitleSelector, obj).first().text().trim() ||
                $(".g_pages .inside_p", obj).first().text().trim() ||
                undefined;

            tiles.push({
                mangaId,
                title: Application.decodeHTMLEntities(title),
                subtitle:
                    subtitle && subtitle.length
                        ? Application.decodeHTMLEntities(subtitle)
                        : undefined,
                imageUrl,
            });
        }

        return tiles;
    }

    async parseMangaDetails(
        $: CheerioAPI,
        mangaId: string,
        source: BentaiGeneric,
    ): Promise<SourceManga> {
        const title =
            $("div.right_details h1").first().text().trim() ||
            $("h1").first().text().trim();

        const thumbnail =
            (await this.getImageSrc($(".left_cover img").first(), source)) ||
            (await this.getImageSrc($("img.lazy").first(), source));

        const tagSection: Tag[] = [];
        $('a[href*="/tag/"]')
            .filter((_idx, el) =>
                /\/tag\/[^/]+\/?$/i.test($(el).attr("href") ?? ""),
            )
            .each((_idx, el) => {
                const tagEl = $(el);
                const id = this.idFromHref(tagEl.attr("href") ?? "");
                const tagTitle = this.extractTagTitle(tagEl);
                if (!id || !tagTitle) return;

                if (!tagSection.find((t) => t.id === id)) {
                    tagSection.push({
                        id,
                        title: Application.decodeHTMLEntities(tagTitle),
                    });
                }
            });

        const tagGroups: TagSection[] = tagSection.length
            ? [{ id: "tags", title: "Tags", tags: tagSection }]
            : [];

        // Try multiple approaches to find the artist
        let artist: string | undefined;

        // Approach 1: Look for <li> with a <span> containing "artist"
        artist =
            $("li")
                .filter((_idx, el) => {
                    const label = $(el)
                        .find("span")
                        .first()
                        .text()
                        .trim()
                        .toLowerCase();
                    return label.includes("artist");
                })
                .find("a")
                .first()
                .text()
                .trim() || undefined;

        // Approach 2: Look for links with /artist/ in the href (for sites like HentaiFox)
        if (!artist) {
            artist =
                $('a[href*="/artist/"]')
                    .first()
                    .text()
                    .trim()
                    .replace(/\s*\(\s*[\d,.]+\s*\)\s*$/, "") // Remove trailing count like "(123)"
                    .replace(/[\s\u00A0]*[\d,.]+$/, "") || undefined; // Remove trailing numbers
        }

        const languageSlug =
            $('li:has(span.tags_text:contains("Language")) a')
                .first()
                .attr("href")
                ?.split("/")
                .filter(Boolean)
                .pop() ?? "";

        const synopsis = tagSection.length
            ? `Tags: ${tagSection.map((x) => x.title).join(", ")}`
            : "";

        return {
            mangaId,
            mangaInfo: {
                primaryTitle: Application.decodeHTMLEntities(title),
                secondaryTitles: [],
                thumbnailUrl: thumbnail,
                synopsis: synopsis,
                author: artist,
                artist: artist,
                status: "Completed",
                contentRating: ContentRating.ADULT,
                tagGroups,
                shareUrl: `${source.domain}/gallery/${mangaId}/`,
                additionalInfo: {
                    Language: this.languageFromSlug(
                        languageSlug,
                        source.language,
                    ),
                },
            },
        };
    }

    parseChapterList(
        $: CheerioAPI,
        sourceManga: SourceManga,
        source: BentaiGeneric,
    ): Chapter[] {
        const languageSlug =
            $('li:has(span.tags_text:contains("Language")) a')
                .first()
                .attr("href")
                ?.split("/")
                .filter(Boolean)
                .pop() ?? "";

        const chapterTitle =
            $("div.right_details h1").first().text().trim() ||
            sourceManga.mangaInfo.primaryTitle;

        return [
            {
                chapterId: `${sourceManga.mangaId}-1`,
                sourceManga,
                langCode: this.languageFromSlug(languageSlug, source.language),
                chapNum: 1,
                title: Application.decodeHTMLEntities(chapterTitle),
                sortingIndex: 1,
            },
        ];
    }

    async parseChapterDetails(
        $: CheerioAPI,
        chapter: Chapter,
        source: BentaiGeneric,
    ): Promise<ChapterDetails> {
        const pageCount = Number(
            $("#load_pages").attr("value") ?? $("#pages").attr("value") ?? 0,
        );
        const imgDir =
            $("#load_dir").attr("value") ?? $("#image_dir").attr("value") ?? "";
        const imgId =
            $("#load_id").attr("value") ?? $("#gallery_id").attr("value") ?? "";
        const serverId =
            $("#load_server").attr("value") ?? $("#s_id").attr("value") ?? "";

        const gThMap = this.parseGthMap($);

        if (!pageCount || !imgDir || !imgId) {
            throw new Error(
                `Unable to parse chapter data for mangaId:${chapter.sourceManga.mangaId}`,
            );
        }

        const sampleImage = await this.getImageSrc(
            $("img.lazy").first(),
            source,
        );
        const cleanedSample = this.stripThumbnailSuffix(sampleImage);
        let imageExtension = this.extractExtension(cleanedSample) ?? "jpg";

        let baseHost =
            this.hostFromServer(serverId, source) ??
            this.deriveImageHost(source, cleanedSample);

        // Try to confirm the image host and extension from the first reader page
        try {
            const [resp, buffer] = await Application.scheduleRequest({
                url: `${source.domain}/view/${chapter.sourceManga.mangaId}/1/`,
                method: "GET",
            });

            if (resp.status < 400) {
                const $$ = load(Application.arrayBufferToUTF8String(buffer));
                const viewImg = await this.getImageSrc(
                    $$("#gimg").first().length
                        ? $$("#gimg").first()
                        : $$("img.lazy").first(),
                    source,
                );

                if (viewImg) {
                    imageExtension =
                        this.extractExtension(viewImg) ?? imageExtension;
                    baseHost =
                        this.deriveImageHost(source, viewImg) ?? baseHost;
                }
            }
        } catch {
            /* ignore and fall back to gallery data */
        }

        const pages: string[] = [];
        for (let i = 1; i <= pageCount; i++) {
            const pageExt =
                this.extensionFromGth(gThMap?.[i.toString()]) ?? imageExtension;

            pages.push(`${baseHost}/${imgDir}/${imgId}/${i}.${pageExt}`);
        }

        return {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages,
        };
    }

    async parseTags($: CheerioAPI): Promise<Tag[]> {
        const tags: Tag[] = [];

        for (const el of $('a[href*="/tag/"]').toArray()) {
            const href = $(el).attr("href") ?? "";
            if (!/\/tag\/[^/]+\/?$/i.test(href)) continue;

            const id = this.idFromHref(href);
            const title = this.extractTagTitle($(el));
            if (!id || !title) continue;

            if (!tags.find((t) => t.id === id)) {
                tags.push({ id, title: Application.decodeHTMLEntities(title) });
            }

            if (tags.length >= 200) break; // Avoid overly large lists
        }

        return tags;
    }

    // Helpers
    private extractTagTitle(tagEl: Cheerio<Element>): string | undefined {
        // Get full text and subtract badge/count spans without DOM cloning
        let text = tagEl.text().trim();

        // Remove text from badge spans (counts like "123" or "(456)")
        tagEl.find("span").each((_, el) => {
            const span = tagEl.find(el);
            const cls = span.attr("class") ?? "";
            const spanText = span.text().trim();
            if (/badge|t_badge/i.test(cls) || /^[\d,.\s]+$/.test(spanText)) {
                text = text.replace(spanText, "");
            }
        });

        text = text
            .trim()
            .replace(/\s*\(\s*[\d,.]+\s*\)\s*$/, "")
            .replace(/[\s\u00A0]*[\d,.]+$/, "");

        return text || undefined;
    }

    private idFromHref(href: string): string | undefined {
        const clean = href.replace(/\/$/, "");
        const segments = clean.split("/");
        const last = segments.pop() ?? "";
        return last || undefined;
    }

    private languageFromSlug(slug: string, fallback: string): string {
        const normalized = slug.toLowerCase();
        const map: Record<string, string> = {
            english: "🇬🇧",
            translated: "🇬🇧",
            spanish: "🇪🇸",
            japanese: "🇯🇵",
            chinese: "🇨🇳",
            korean: "🇰🇷",
            russian: "🇷🇺",
            french: "🇫🇷",
            german: "🇩🇪",
            portuguese: "🇵🇹",
            italian: "🇮🇹",
            thai: "🇹🇭",
            vietnamese: "🇻🇳",
        };

        return map[normalized] ?? fallback;
    }

    private deriveImageHost(source: BentaiGeneric, sample?: string): string {
        const fromSample = this.extractHost(sample);
        if (fromSample) return fromSample;

        const fromSource = this.extractHost(source.domain);
        if (fromSource) return fromSource;

        return source.domain;
    }

    async getImageSrc(
        imageObj: Cheerio<Element> | undefined,
        source: BentaiGeneric,
    ): Promise<string> {
        let image: string | undefined =
            imageObj?.attr("data-src") ||
            imageObj?.attr("data-original") ||
            imageObj?.attr("data-cfsrc") ||
            imageObj?.attr("data-lazy-src") ||
            imageObj?.attr("data-bg") ||
            imageObj?.attr("srcset")?.split(" ")?.[0] ||
            imageObj?.attr("src") ||
            "";

        if (getUseHQThumbnails()) {
            image = image
                ?.replace(/\/thumb\.jpg$/i, "/cover.jpg")
                ?.replace(/\/(\d+)t\.jpg$/i, "/$1.jpg");
        }

        if (image?.startsWith("//")) {
            image = `https:${image}`;
        } else if (image?.startsWith("/")) {
            image = `${source.domain}${image}`;
        }

        image = image?.trim().replace(/\s+/g, "");
        return decodeURI(Application.decodeHTMLEntities(image ?? ""));
    }

    private hostFromServer(
        serverId?: string,
        source?: BentaiGeneric,
    ): string | undefined {
        const digits = serverId?.match(/\d+/)?.[0];
        if (!digits) return undefined;
        const host = this.extractHostname(source?.domain);
        if (!host) return undefined;
        return `https://m${digits}.${host}`;
    }

    private stripThumbnailSuffix(image?: string): string | undefined {
        return image?.replace(/\/(\d+)t(\.[a-z0-9]+)(\?.*)?$/i, "/$1$2");
    }

    private extractExtension(image?: string): string | undefined {
        const match = image?.match(/\.([a-z0-9]+)(?:$|\?)/i);
        return match?.[1]?.toLowerCase();
    }

    private parseGthMap($: CheerioAPI): Record<string, string> | undefined {
        const scripts = $("script")
            .map((_, el) => $(el).html() ?? "")
            .get();
        const scriptWithGth = scripts.find((s) => s.includes("var g_th"));
        if (!scriptWithGth) return undefined;

        const match = scriptWithGth.match(
            /var\s+g_th\s*=\s*\$\.parseJSON\('([^']+)'\)/i,
        );
        if (!match?.[1]) return undefined;

        try {
            return JSON.parse(match[1]) as Record<string, string>;
        } catch {
            return undefined;
        }
    }

    private extensionFromGth(entry?: string): string | undefined {
        if (!entry) return undefined;
        const code = entry.split(",")[0]?.trim().toLowerCase();
        switch (code) {
            case "w":
                return "webp";
            case "j":
                return "jpg";
            case "p":
                return "png";
            default:
                return undefined;
        }
    }

    private extractHost(url?: string): string | undefined {
        const match = url?.match(/^(https?:)?\/\/([^/]+)/i);
        if (!match || !match[2]) return undefined;
        const protocol = match[1] ?? "https:";
        return `${protocol}//${match[2]}`;
    }

    private extractHostname(url?: string): string | undefined {
        const match = url?.match(/^(?:https?:)?\/\/([^/]+)/i);
        return match?.[1];
    }
}
