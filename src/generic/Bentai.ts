import {
    BasicRateLimiter,
    Chapter,
    ChapterDetails,
    ChapterProviding,
    CloudflareBypassRequestProviding,
    CloudflareError,
    ContentRating,
    Cookie,
    DiscoverSection,
    DiscoverSectionItem,
    DiscoverSectionProviding,
    DiscoverSectionType,
    Extension,
    Form,
    MangaProviding,
    PagedResults,
    PaperbackInterceptor,
    Response,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    SearchResultsProviding,
    SettingsFormProviding,
    SourceManga,
    URL,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { BentaiInterceptor } from "./BentaiInterceptor";
import { BentaiParser } from "./BentaiParser";
import { BentaiSettings } from "./BentaiSettings";

export interface GenericParams {
    name: string;
    domain: string;
    contentRating: ContentRating;
    language: string;
    searchPath?: string;
    searchParamKey?: string;
    gallerySelector?: string;
    subtitleSelector?: string;
    paginationType?: "query" | "path";
    pageParamKey?: string;
    pagePathSegment?: string;
    searchPaginationType?: "query" | "path";
    searchOnRoot?: boolean;
    searchAllOnRoot?: boolean;
    skipFirstPagePath?: boolean;
    parser?: BentaiParser;
    requestManager?: PaperbackInterceptor;
}

type Metadata = {
    page?: number;
};

type GalleryCache = {
    mangaId: string;
    $: cheerio.CheerioAPI;
    timestamp: number;
};

export abstract class BentaiGeneric
    implements
        Extension,
        SearchResultsProviding,
        MangaProviding,
        ChapterProviding,
        DiscoverSectionProviding,
        SettingsFormProviding,
        CloudflareBypassRequestProviding
{
    readonly domain: string;
    readonly name: string;
    readonly defaultContentRating: ContentRating;
    readonly language: string;
    readonly searchPath: string;
    readonly searchParamKey: string;
    readonly gallerySelector: string;
    readonly subtitleSelector: string;
    readonly paginationType: "query" | "path";
    readonly searchPaginationType: "query" | "path";
    readonly pageParamKey: string;
    readonly pagePathSegment: string;
    readonly searchOnRoot: boolean;
    readonly searchAllOnRoot: boolean;
    readonly skipFirstPagePath: boolean;
    parser: BentaiParser;
    requestManager: PaperbackInterceptor;

    // Cache for gallery page to avoid duplicate requests between getMangaDetails and getChapters
    private galleryCache: GalleryCache | null = null;
    private readonly galleryCacheTTL = 30000; // 30 seconds

    constructor(params: GenericParams) {
        this.name = params.name;
        this.domain = params.domain;
        this.defaultContentRating = params.contentRating ?? ContentRating.ADULT;
        this.language = params.language ?? "🇬🇧";
        this.searchPath = params.searchPath ?? "/search/";
        this.searchParamKey = params.searchParamKey ?? "key";
        this.gallerySelector =
            params.gallerySelector ??
            "div.galleries, div.row.galleries, div.lc_galleries";
        this.subtitleSelector =
            params.subtitleSelector ??
            "h3.gallery_cat, a.thumb_cat, a.t_cat, .g_cat a";
        this.paginationType = params.paginationType ?? "query";
        this.searchPaginationType =
            params.searchPaginationType ?? this.paginationType;
        this.pageParamKey = params.pageParamKey ?? "page";
        this.pagePathSegment = params.pagePathSegment ?? "page";
        this.searchOnRoot = params.searchOnRoot ?? false;
        this.searchAllOnRoot = params.searchAllOnRoot ?? this.searchOnRoot;
        this.skipFirstPagePath = params.skipFirstPagePath ?? false;
        this.parser = params.parser ?? new BentaiParser();
        this.requestManager =
            params.requestManager ?? new BentaiInterceptor("main", this);
    }

    globalRateLimiter = new BasicRateLimiter("ratelimiter", {
        numberOfRequests: 5,
        bufferInterval: 1,
        ignoreImages: true,
    });

    async initialise(): Promise<void> {
        this.globalRateLimiter.registerInterceptor();
        this.requestManager?.registerInterceptor();
    }

    async getSettingsForm(): Promise<Form> {
        return new BentaiSettings(this);
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const $ = await this.getGalleryPage(mangaId);
        return this.parser.parseMangaDetails($, mangaId, this);
    }

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const $ = await this.getGalleryPage(sourceManga.mangaId);
        return this.parser.parseChapterList($, sourceManga, this);
    }

    private async getGalleryPage(mangaId: string): Promise<cheerio.CheerioAPI> {
        const now = Date.now();

        // Return cached result if valid
        if (
            this.galleryCache &&
            this.galleryCache.mangaId === mangaId &&
            now - this.galleryCache.timestamp < this.galleryCacheTTL
        ) {
            return this.galleryCache.$;
        }

        const [response, buffer] = await Application.scheduleRequest({
            url: `${this.domain}/gallery/${mangaId}/`,
            method: "GET",
        });
        await this.checkResponseError(response);

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));

        // Cache the result
        this.galleryCache = { mangaId, $, timestamp: now };

        return $;
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const [response, buffer] = await Application.scheduleRequest({
            url: `${this.domain}/gallery/${chapter.sourceManga.mangaId}/`,
            method: "GET",
        });
        await this.checkResponseError(response);

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        return this.parser.parseChapterDetails($, chapter, this);
    }

    async getDiscoverSections(): Promise<DiscoverSection[]> {
        return [
            {
                id: "latest",
                title: "Latest Galleries",
                type: DiscoverSectionType.simpleCarousel,
            },
        ];
    }

    async getDiscoverSectionItems(
        section: DiscoverSection,
        metadata: Metadata | undefined,
    ): Promise<PagedResults<DiscoverSectionItem>> {
        if (section.id !== "latest") {
            throw new Error(`Unsupported section id: ${section.id}`);
        }

        const page = metadata?.page ?? 1;
        const url = this.buildPageUrl(page);
        const [response, buffer] = await Application.scheduleRequest({
            url,
            method: "GET",
        });
        await this.checkResponseError(response);

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        const tiles = await this.parser.parseDirectory($, this);

        const items: DiscoverSectionItem[] = tiles.map((tile) => ({
            mangaId: tile.mangaId,
            imageUrl: tile.imageUrl,
            title: tile.title,
            subtitle: tile.subtitle,
            type: "simpleCarouselItem",
            contentRating: this.defaultContentRating,
        }));

        return {
            items,
            metadata: { page: page + 1 },
        };
    }

    async getSearchFilters(): Promise<SearchFilter[]> {
        const [response, buffer] = await Application.scheduleRequest({
            url: `${this.domain}/tags/popular/`,
            method: "GET",
        });

        // If a tags page is blocked, return no filters quietly
        if (response.status >= 400) {
            return [];
        }

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        const tags = await this.parser.parseTags($);

        if (!tags.length) {
            return [];
        }

        return [
            {
                type: "multiselect",
                id: "tags",
                title: "Tags",
                allowExclusion: false,
                allowEmptySelection: true,
                options: tags.map((tag) => ({
                    id: tag.id,
                    value: tag.title,
                })),
                maximum: undefined,
                value: {},
            },
        ];
    }

    async getSearchResults(
        query: SearchQuery,
        metadata: Metadata | undefined,
    ): Promise<PagedResults<SearchResultItem>> {
        const page = metadata?.page ?? 1;
        const url = this.buildSearchUrl(page, query);
        const [response, buffer] = await Application.scheduleRequest({
            url,
            method: "GET",
        });
        await this.checkResponseError(response);

        const $ = cheerio.load(Application.arrayBufferToUTF8String(buffer));
        const tiles = await this.parser.parseDirectory($, this);

        const items: SearchResultItem[] = tiles.map((tile) => ({
            mangaId: tile.mangaId,
            imageUrl: tile.imageUrl,
            title: tile.title,
            subtitle: tile.subtitle,
            contentRating: this.defaultContentRating,
        }));

        return {
            items,
            metadata: items.length ? { page: page + 1 } : undefined,
        };
    }

    async saveCloudflareBypassCookies(cookies: Cookie[]): Promise<void> {
        for (const cookie of cookies) {
            Application.setState(cookie.value, `cookie_${cookie.name}`);
        }
    }

    // Utilities
    private buildPageUrl(page: number): string {
        if (this.paginationType === "path") {
            if (this.skipFirstPagePath && page <= 1) {
                return `${this.domain}/`;
            }
            const url = new URL(this.domain);
            url.addPathComponent(this.pagePathSegment);
            url.addPathComponent(page.toString());
            url.addPathComponent("");
            return url.toString();
        }

        const url = new URL(this.domain);
        url.setQueryItem(this.pageParamKey, page.toString());
        return url.toString();
    }

    private buildTagUrl(page: number, tagId: string): string {
        const base = new URL(this.domain)
            .addPathComponent("tag")
            .addPathComponent(`${tagId}/`);

        if (this.paginationType === "path") {
            if (!(this.skipFirstPagePath && page <= 1)) {
                base.addPathComponent(this.pagePathSegment);
                base.addPathComponent(page.toString());
                base.addPathComponent("");
            }
            return base.toString();
        }

        base.setQueryItem(this.pageParamKey, page.toString());
        return base.toString();
    }

    private buildSearchUrl(page: number, query: SearchQuery): string {
        const tagFilter = query.filters?.find((x) => x.id === "tags");
        const selectedTags = Object.keys(
            (tagFilter?.value ?? {}) as Record<string, unknown>,
        );

        if (!query.title?.trim() && selectedTags.length) {
            return this.buildTagUrl(page, selectedTags[0]);
        }

        const url = new URL(this.domain);
        const hasTitle = !!query.title?.trim();
        const useRoot = hasTitle ? this.searchOnRoot : this.searchAllOnRoot;

        if (!useRoot) {
            url.addPathComponent(this.searchPath.replace(/^\//, ""));
        }

        const paginationType = this.searchPaginationType ?? this.paginationType;

        if (paginationType === "path") {
            if (!(this.skipFirstPagePath && page <= 1)) {
                url.addPathComponent(this.pagePathSegment);
                url.addPathComponent(page.toString());
                url.addPathComponent("");
            }
        } else {
            url.setQueryItem(this.pageParamKey, page.toString());
        }

        if (query.title?.trim()) {
            url.setQueryItem(
                this.searchParamKey,
                this.sanitizeQuery(query.title),
            );
        }

        return url.toString();
    }

    private sanitizeQuery(query: string): string {
        return query.replace(/\s+/g, " ").trim();
    }

    async checkResponseError(response: Response): Promise<void> {
        const status = response.status;
        switch (status) {
            case 403:
            case 503:
                throw new CloudflareError(
                    {
                        url: this.domain,
                        method: "GET",
                        headers: {
                            referer: `${this.domain}/`,
                            origin: `${this.domain}/`,
                            "user-agent":
                                await Application.getDefaultUserAgent(),
                        },
                    },
                    "Cloudflare detected!\nPlease run the bypass for this source.",
                );
            case 404:
                throw new Error(
                    `The requested page ${response.url} was not found!`,
                );
        }
    }
}
