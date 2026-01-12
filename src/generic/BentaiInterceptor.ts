import { PaperbackInterceptor, Request, Response } from "@paperback/types";
import { BentaiGeneric } from "./Bentai";

export class BentaiInterceptor extends PaperbackInterceptor {
    source: BentaiGeneric;

    constructor(id: string, source: BentaiGeneric) {
        super(id);
        this.source = source;
    }

    override async interceptRequest(request: Request): Promise<Request> {
        request.headers = {
            ...(request.headers ?? {}),
            "user-agent":
                request.headers?.["user-agent"] ??
                (await Application.getDefaultUserAgent()),
            referer: `${this.source.domain}/`,
            origin: `${this.source.domain}`,
            ...(request.url.includes("hentaifox.com") && {
                Accept:
                    request.headers?.Accept ??
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            }),
        };

        return request;
    }

    override async interceptResponse(
        _request: Request,
        _response: Response,
        data: ArrayBuffer,
    ): Promise<ArrayBuffer> {
        return data;
    }
}
