import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";
import { getVersion } from "../generic/BentaiHelper";

export default {
    name: "HentaiFox",
    description: "Extension that pulls content from hentaifox.com.",
    version: getVersion(),
    icon: "icon.png",
    language: "🇬🇧",
    contentRating: ContentRating.ADULT,
    badges: [],
    capabilities:
        SourceIntents.MANGA_CHAPTERS |
        SourceIntents.DISCOVER_SECIONS |
        SourceIntents.SETTINGS_UI |
        SourceIntents.MANGA_SEARCH |
        SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
    developers: [
        {
            name: "Inkdex",
            github: "https://inkdex.github.io",
        },
    ],
} satisfies SourceInfo;
