import { BentaiGeneric } from "../generic/Bentai";
import pbconfig from "./pbconfig";

const DOMAIN = "https://comicporn.xxx";

class ComicPornExtension extends BentaiGeneric {
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
        });
    }
}

export const ComicPorn = new ComicPornExtension();
