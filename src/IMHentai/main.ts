import { BentaiGeneric } from "../generic/Bentai";
import pbconfig from "./pbconfig";

const DOMAIN = "https://imhentai.xxx";

class IMHentaiExtension extends BentaiGeneric {
    constructor() {
        super({
            domain: DOMAIN,
            name: pbconfig.name,
            contentRating: pbconfig.contentRating,
            language: pbconfig.language,
            pageParamKey: "page",
            paginationType: "query",
            searchParamKey: "key",
            searchOnRoot: false,
            searchAllOnRoot: true,
            subtitleSelector: "a.thumb_cat, h3.gallery_cat",
        });
    }
}

export const IMHentai = new IMHentaiExtension();
