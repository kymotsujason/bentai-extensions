import { BentaiGeneric } from "../generic/Bentai";
import pbconfig from "./pbconfig";

const DOMAIN = "https://hentaiera.com";

class HentaiEraExtension extends BentaiGeneric {
    constructor() {
        super({
            domain: DOMAIN,
            name: pbconfig.name,
            contentRating: pbconfig.contentRating,
            language: pbconfig.language,
            pageParamKey: "page",
            paginationType: "query",
            searchParamKey: "key",
            searchOnRoot: false, // uses /search/
        });
    }
}

export const HentaiEra = new HentaiEraExtension();
