import { BentaiGeneric } from "../generic/Bentai";
import pbconfig from "./pbconfig";

const DOMAIN = "https://hentaifox.com";

class HentaiFoxExtension extends BentaiGeneric {
    constructor() {
        super({
            domain: DOMAIN,
            name: pbconfig.name,
            contentRating: pbconfig.contentRating,
            language: pbconfig.language,
            searchParamKey: "q",
            paginationType: "path",
            searchPaginationType: "path",
            pagePathSegment: "page",
            skipFirstPagePath: true,
            searchOnRoot: false,
            searchAllOnRoot: true,
            gallerySelector:
                "div.lc_galleries, div.galleries, div.row.galleries",
            subtitleSelector: "a.t_cat, h3.gallery_cat",
        });
    }
}

export const HentaiFox = new HentaiFoxExtension();
