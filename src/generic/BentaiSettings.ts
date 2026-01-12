import {
    Form,
    FormSectionElement,
    LabelRow,
    Section,
    ToggleRow,
} from "@paperback/types";
import { BentaiGeneric } from "./Bentai";

function toBoolean(value: unknown): boolean | undefined {
    if (value === true || value === "true" || value === 1) return true;
    if (value === false || value === "false" || value === 0) return false;
    return undefined;
}

export function getUseHQThumbnails(): boolean {
    return toBoolean(Application.getState("hq_thumbnails")) ?? false;
}

export function setUseHQThumbnails(value: boolean): void {
    Application.setState(value.toString(), "hq_thumbnails");
}

export class BentaiSettings extends Form {
    source: BentaiGeneric;
    constructor(source: BentaiGeneric) {
        super();
        this.source = source;
    }

    override getSections(): FormSectionElement[] {
        return [
            Section(`${this.source.name} Settings`.replaceAll(" ", ""), [
                ToggleRow("hqThumbnails", {
                    title: "Enable HQ Thumbnails",
                    value: getUseHQThumbnails(),
                    onValueChange: Application.Selector(
                        this as BentaiSettings,
                        "useHQThumbnailsChange",
                    ),
                    subtitle:
                        "Converts gallery thumbnails to higher resolution where available (may use more data).",
                }),
                LabelRow("info", {
                    title: "",
                    subtitle:
                        "These sites can be slow or rate limited; keep requests modest for best results.",
                }),
            ]),
        ];
    }

    async useHQThumbnailsChange(value: boolean): Promise<void> {
        setUseHQThumbnails(value);
    }
}
