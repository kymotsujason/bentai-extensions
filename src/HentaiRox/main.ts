import { BentaiGeneric } from "../generic/Bentai";
import pbconfig from "./pbconfig";

const DOMAIN = "https://hentairox.com";

class HentaiRoxExtension extends BentaiGeneric {
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

export const HentaiRox = new HentaiRoxExtension();
